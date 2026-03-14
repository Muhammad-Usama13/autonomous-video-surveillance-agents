"""
agents/report_agent.py – Converts structured findings into natural-language reports via Gemini.

Improvement over doc: also provides a structured JSON payload alongside
prose so the frontend can render rich incident cards, not just text.
Falls back to a template-based report if Gemini is unavailable.
"""
from __future__ import annotations
import json
from typing import Optional

try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

from core.config import settings
from agents.vision_agent import VisionResult
from agents.motion_agent import MotionResult
from agents.behavior_agent import BehaviorResult
from agents.reasoning_agent import ReasoningResult


_GEMINI_CONFIGURED = False


def _ensure_gemini():
    global _GEMINI_CONFIGURED
    if _GEMINI_CONFIGURED or not GEMINI_AVAILABLE or not settings.GEMINI_API_KEY:
        return
    genai.configure(api_key=settings.GEMINI_API_KEY)
    _GEMINI_CONFIGURED = True


class ReportAgent:
    """
    Generates a human-readable incident report for a confirmed anomaly.
    Uses Gemini 3.0 preview (fast & cheap).  Gracefully degrades to a
    template-based report when Gemini is not configured.
    """

    MODEL = "gemini-2.5-flash"

    def __init__(self):
        _ensure_gemini()
        self._model = None
        if GEMINI_AVAILABLE and settings.GEMINI_API_KEY:
            try:
                self._model = genai.GenerativeModel(self.MODEL)
            except Exception as e:
                print(f"[ReportAgent] Gemini init failed: {e}")

    # ── Public API ────────────────────────────────────────────────────────

    def generate(
        self,
        timestamp: str,
        vision: VisionResult,
        motion: MotionResult,
        behavior: BehaviorResult,
        reasoning: ReasoningResult,
    ) -> str:
        context = self._build_context(timestamp, vision, motion, behavior, reasoning)
        if self._model:
            return self._gemini_report(context)
        return self._template_report(context, reasoning)

    # ── Internals ─────────────────────────────────────────────────────────

    def _build_context(self, timestamp, vision, motion, behavior, reasoning) -> dict:
        return {
            "timestamp": timestamp,
            "persons_detected": vision.person_count,
            "vehicles_detected": vision.vehicle_count,
            "mean_motion": motion.mean_magnitude,
            "sudden_motion": motion.sudden_motion,
            "dominant_direction": motion.dominant_direction,
            "behaviors": behavior.behaviors,
            "severity": behavior.severity,
            "classified_event": reasoning.classified_event,
            "threat_score": reasoning.threat_score,
            "reasoning_notes": reasoning.reasoning_notes,
        }

    def _gemini_report(self, ctx: dict) -> str:
        prompt = f"""You are a security AI assistant writing a concise incident report.
Given the following surveillance analysis data, write a professional 2-3 sentence
incident description in plain English. Be specific, factual, and avoid speculation.

Data:
{json.dumps(ctx, indent=2)}

Write only the incident description, no headers, no bullet points.
"""
        try:
            response = self._model.generate_content(prompt)
            return response.text.strip()
        except Exception as e:
            print(f"[ReportAgent] Gemini error: {e}")
            return self._template_report(ctx, None)

    def _template_report(self, ctx: dict, reasoning: Optional[ReasoningResult]) -> str:
        ev = ctx["classified_event"].replace("_", " ").title()
        ts = ctx["timestamp"]
        p  = ctx["persons_detected"]
        m  = ctx["mean_motion"]
        dir_ = ctx["dominant_direction"]
        sev = ctx["severity"].upper()

        return (
            f"[{sev}] At {ts}, a '{ev}' event was detected. "
            f"{p} person(s) observed with mean motion magnitude {m:.2f} "
            f"moving predominantly {dir_}. "
            f"Immediate review by security personnel is recommended."
        )

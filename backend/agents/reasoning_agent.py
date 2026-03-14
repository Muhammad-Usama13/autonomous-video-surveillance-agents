"""
agents/reasoning_agent.py - Simplified to match new BehaviorAgent design.

BehaviorAgent now sets is_anomaly=True only when a behavior has been sustained
for SUSTAIN_FRAMES consecutive frames, so this layer just needs to:
  1. Accept the anomaly decision
  2. Apply a dedup window so same event doesn't spam reports
  3. Compute a confidence score
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict

from agents.vision_agent import VisionResult
from agents.motion_agent import MotionResult
from agents.behavior_agent import BehaviorResult


SCORE_WEIGHTS = {
    "crowd_panic":          1.0,
    "fight_or_aggression":  0.9,
    "overcrowding":         0.6,
    "crowd_gathering":      0.5,
    "suspicious_loitering": 0.4,
}


@dataclass
class ReasoningResult:
    frame_idx: int
    threat_score: float = 0.0
    classified_event: str = "normal"
    severity: str = "low"
    confidence: float = 0.0
    reasoning_notes: List[str] = field(default_factory=list)
    should_report: bool = False


class ReasoningAgent:

    def __init__(self):
        self._last_reported: Dict[str, int] = {}
        self._DEDUP_FRAMES = 90

    def reset(self):
        self._last_reported.clear()

    def evaluate(
        self,
        vision: VisionResult,
        motion: MotionResult,
        behavior: BehaviorResult,
        frame_idx: int,
    ) -> ReasoningResult:

        non_normal = [b for b in behavior.behaviors if b != "normal"]
        primary    = max(non_normal, key=lambda b: SCORE_WEIGHTS.get(b, 0)) \
                     if non_normal else "normal"

        score = sum(SCORE_WEIGHTS.get(b, 0) for b in non_normal)
        score = min(score, 1.0)

        # Dedup: don't re-report same event within DEDUP_FRAMES
        last     = self._last_reported.get(primary, -9999)
        too_soon = (frame_idx - last) < self._DEDUP_FRAMES

        should_report = (
            behavior.is_anomaly
            and primary != "normal"
            and not too_soon
        )

        if should_report:
            self._last_reported[primary] = frame_idx

        confidence = round((score * behavior.confidence) ** 0.5, 3)

        return ReasoningResult(
            frame_idx=frame_idx,
            threat_score=round(score, 3),
            classified_event=primary,
            severity=behavior.severity,
            confidence=confidence,
            reasoning_notes=[f"behavior={primary} score={score:.2f}"],
            should_report=should_report,
        )
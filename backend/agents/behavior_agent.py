"""
agents/behavior_agent.py - Redesigned from diagnostic data.

Root causes of 0 detections (identified Mar 14 2026):
  1. Cooldown + vote_buffer conflicted: cooldown blocked detections so vote
     buffer never filled with 4 consecutive Trues.
  2. unusual_speed threshold (4σ = 0.42) fires on normal crowd (max=3-7 always)
  3. overcrowding (10+ people) fires every few frames but cooldown blocks it

NEW DESIGN:
  - Remove cooldown entirely — replaced by per-behavior sustained counters
  - Each behavior has its own counter that increments each frame it's detected
  - Anomaly fires when ANY behavior counter reaches SUSTAIN_FRAMES (=5)
  - After firing, that counter resets (natural re-arm after it stops)
  - unusual_speed removed as standalone rule (Farneback max on crowds is always 3-7)
  - overcrowding: person_count >= 10 for 5 consecutive processed frames
  - crowd_gathering: 4-9 people AND motion < gather_threshold for 5 frames
  - crowd_panic: needs sudden_motion=True (a real spike) which never happens in normal walking

Calibrated values from actual video:
  - Normal crowd: persons=10-15, mean=0.26-0.38, max=2.4-6.9, sudden=NEVER
  - Baseline after 20 frames: mean=0.3241, std=0.0243
  - gather_thr = mean + 0.3*std = 0.3314  (most frames are above this, so
    only truly slow/stationary crowds trigger it)
"""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Dict
from collections import deque
import numpy as np

from agents.vision_agent import VisionResult
from agents.motion_agent import MotionResult


SEVERITY_MAP = {
    "crowd_panic":          "critical",
    "fight_or_aggression":  "high",
    "overcrowding":         "medium",
    "crowd_gathering":      "medium",
    "suspicious_loitering": "low",
    "normal":               "low",
}


@dataclass
class BehaviorResult:
    frame_idx: int
    behaviors: List[str] = field(default_factory=list)
    severity: str = "low"
    confidence: float = 0.0
    is_anomaly: bool = False
    details: dict = field(default_factory=dict)


class BehaviorAgent:
    """
    Sustained-detection classifier.

    Each behavior has a counter. The counter increments each processed frame
    the behavior condition is met, and resets when it is not.
    An anomaly is declared when any counter reaches SUSTAIN_FRAMES.
    After firing, that counter resets to 0 (natural debounce).

    This avoids the cooldown/vote-buffer conflict entirely.
    """

    BASELINE_FRAMES        = 20
    SUSTAIN_FRAMES         = 5     # consecutive frames needed to confirm

    # People thresholds
    OVERCROWD_THRESHOLD    = 10
    CROWD_PANIC_MIN        = 4
    GATHER_MIN             = 4
    GATHER_MAX             = 9     # gathering = 4-9 people slowing down

    # Motion multipliers (× baseline_std above baseline_mean)
    PANIC_STD_MULT         = 3.0   # panic: well above normal (needs sudden_motion too)
    GATHER_STD_MULT        = 0.5   # gathering: below mean + 0.5*std

    def __init__(self):
        self._counters: Dict[str, int] = {
            "overcrowding":         0,
            "crowd_gathering":      0,
            "crowd_panic":          0,
            "fight_or_aggression":  0,
            "suspicious_loitering": 0,
        }
        self._fired:   Dict[str, int] = {}  # behavior → last frame fired (for dedup)
        self._baseline_samples: list  = []
        self._baseline_mean:  float   = 0.3241   # sensible default from observed data
        self._baseline_std:   float   = 0.0243
        self._baseline_ready: bool    = False
        self._DEDUP_FRAMES            = 60   # min frames between same incident

    def reset(self):
        for k in self._counters:
            self._counters[k] = 0
        self._fired.clear()
        self._baseline_samples.clear()
        self._baseline_mean  = 2.5
        self._baseline_std   = 0.5
        self._baseline_ready = False

    # ── Baseline ──────────────────────────────────────────────────────────

    def _update_baseline(self, mean_mag: float):
        if self._baseline_ready or mean_mag == 0.0:
            return
        self._baseline_samples.append(mean_mag)
        if len(self._baseline_samples) >= self.BASELINE_FRAMES:
            arr = np.array(self._baseline_samples)
            self._baseline_mean = float(np.mean(arr))
            self._baseline_std  = max(float(np.std(arr)), 0.01)
            self._baseline_ready = True
            backend = 'SEA-RAFT' if self._baseline_mean > 0.5 else 'Farneback'
            print(f"[BehaviorAgent] Baseline ({backend}): "
                  f"mean={self._baseline_mean:.4f} std={self._baseline_std:.4f}")

    def _thr(self, mult: float) -> float:
        return self._baseline_mean + mult * self._baseline_std

    def _tick(self, name: str, condition: bool, frame_idx: int) -> bool:
        """Increment counter if condition met, reset if not.
        Returns True when counter just hit SUSTAIN_FRAMES AND dedup allows."""
        if condition:
            self._counters[name] += 1
        else:
            self._counters[name] = 0

        if self._counters[name] >= self.SUSTAIN_FRAMES:
            last = self._fired.get(name, -9999)
            if (frame_idx - last) >= self._DEDUP_FRAMES:
                self._counters[name] = 0   # reset after firing
                self._fired[name] = frame_idx
                return True
        return False

    # ── Main ──────────────────────────────────────────────────────────────

    def analyse(self, vision: VisionResult, motion: MotionResult, frame_idx: int) -> BehaviorResult:
        self._update_baseline(motion.mean_magnitude)

        p           = vision.person_count
        mean_mag    = motion.mean_magnitude
        max_mag     = motion.max_magnitude
        sudden      = motion.sudden_motion

        gather_thr  = self._thr(self.GATHER_STD_MULT)
        panic_thr   = self._thr(self.PANIC_STD_MULT)

        detected: List[str] = []
        details:  dict      = {}

        # ── Overcrowding: 10+ people for SUSTAIN_FRAMES consecutive frames ──
        if self._tick("overcrowding",
                      p >= self.OVERCROWD_THRESHOLD,
                      frame_idx):
            detected.append("overcrowding")
            details["overcrowding"] = {"persons": p}

        # ── Crowd gathering: 4-9 people moving slowly ─────────────────────
        if self._tick("crowd_gathering",
                      self.GATHER_MIN <= p <= self.GATHER_MAX and mean_mag < gather_thr,
                      frame_idx):
            detected.append("crowd_gathering")
            details["crowd_gathering"] = {
                "persons": p,
                "motion": round(mean_mag, 4),
                "thr": round(gather_thr, 4),
            }

        # ── Crowd panic: sudden mass movement spike ────────────────────────
        # Requires BOTH a statistical spike AND sudden_motion flag
        if self._tick("crowd_panic",
                      p >= self.CROWD_PANIC_MIN
                      and mean_mag >= panic_thr
                      and sudden,
                      frame_idx):
            detected.append("crowd_panic")
            details["crowd_panic"] = {
                "persons": p,
                "motion": round(mean_mag, 4),
                "thr": round(panic_thr, 4),
            }

        # ── Fight/aggression: violent sudden spike ─────────────────────────
        # max_magnitude must be at least 2× the historical max to count
        fight_thr = self._baseline_mean * 15   # ~4.8 for Farneback baseline
        if self._tick("fight_or_aggression",
                      sudden and p >= 2 and max_mag > fight_thr,
                      frame_idx):
            detected.append("fight_or_aggression")
            details["fight"] = {"max_mag": round(max_mag, 4), "thr": round(fight_thr, 4)}

        # ── Loitering: single person nearly motionless for many frames ──────
        loiter_thr = self._baseline_mean * 0.6
        if self._tick("suspicious_loitering",
                      p == 1 and mean_mag <= loiter_thr,
                      frame_idx):
            detected.append("suspicious_loitering")
            details["loiter"] = {"frames": self.SUSTAIN_FRAMES}

        if not detected:
            detected = ["normal"]

        is_anomaly = any(b != "normal" for b in detected)

        severity = max(
            (SEVERITY_MAP.get(b, "low") for b in detected),
            key=lambda s: ["low", "medium", "high", "critical"].index(s),
            default="low",
        )

        n_det = sum(1 for b in detected if b != "normal")
        confidence = min(0.92, 0.45 + 0.15 * n_det)

        return BehaviorResult(
            frame_idx=frame_idx,
            behaviors=detected,
            severity=severity,
            confidence=round(confidence, 3),
            is_anomaly=is_anomaly,
            details=details,
        )
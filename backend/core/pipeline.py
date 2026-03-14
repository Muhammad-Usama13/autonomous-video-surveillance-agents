"""
core/pipeline.py – Video analysis pipeline with:
  - Resolution-aware behavior thresholds (set_resolution called at start)
  - Browser-compatible video transcoding for all input formats
    (H.265/HEVC, AVI, MOV, MKV → H.264 MP4 that every browser can play)
"""
from __future__ import annotations
import asyncio
import cv2
import os
import subprocess
import shutil
from datetime import datetime
from pathlib import Path
from typing import List
from concurrent.futures import ThreadPoolExecutor

from core.config import settings
from core.schemas import Incident
from agents.vision_agent import VisionAgent
from agents.motion_agent import MotionAgent
from agents.behavior_agent import BehaviorAgent
from agents.reasoning_agent import ReasoningAgent
from agents.report_agent import ReportAgent
from agents.alert_agent import AlertAgent

_CUDA_EXECUTOR = ThreadPoolExecutor(max_workers=1, thread_name_prefix="cuda")

# Browser-incompatible codecs that need transcoding
_NEEDS_TRANSCODE = {"hevc", "hvc1", "hev1", "h265", "vp9", "av01", "dvh1"}


def _frames_to_timestamp(frame_idx: int, fps: float) -> str:
    total_sec = int(frame_idx / fps)
    h = total_sec // 3600
    m = (total_sec % 3600) // 60
    s = total_sec % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


def _run_inference(vision: VisionAgent, motion: MotionAgent, frame, frame_idx):
    v = vision.detect(frame, frame_idx)
    m = motion.analyse(frame, frame_idx)
    return v, m


def _get_codec(video_path: str) -> str:
    """Return lowercase codec name using ffprobe, fallback to opencv."""
    if shutil.which("ffprobe"):
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-select_streams", "v:0",
                 "-show_entries", "stream=codec_name",
                 "-of", "default=noprint_wrappers=1:nokey=1", video_path],
                capture_output=True, text=True, timeout=10
            )
            return result.stdout.strip().lower()
        except Exception:
            pass
    # Fallback: read fourcc from OpenCV
    cap = cv2.VideoCapture(video_path)
    fourcc = int(cap.get(cv2.CAP_PROP_FOURCC))
    cap.release()
    return ''.join([chr((fourcc >> 8 * i) & 0xFF) for i in range(4)]).lower().strip()


def _transcode_to_h264(src: str, dst: str) -> bool:
    """
    Transcode src video to H.264 MP4 for browser compatibility.
    Uses ffmpeg if available, otherwise returns False (serve original).
    """
    if not shutil.which("ffmpeg"):
        print("[Pipeline] ffmpeg not found — serving original file. "
              "Install with: sudo apt install ffmpeg")
        return False
    try:
        cmd = [
            "ffmpeg", "-y", "-i", src,
            "-c:v", "libx264",       # H.264 video — universal browser support
            "-preset", "fast",       # fast encode, reasonable quality
            "-crf", "23",            # quality (18=best, 28=worst, 23=default)
            "-c:a", "aac",           # AAC audio
            "-movflags", "+faststart",  # web-optimised: moov atom at front
            "-loglevel", "error",
            dst
        ]
        subprocess.run(cmd, check=True, timeout=300)
        print(f"[Pipeline] Transcoded to H.264: {dst}")
        return True
    except Exception as e:
        print(f"[Pipeline] Transcode failed: {e}")
        return False


def _prepare_video_for_browser(video_path: str, session_id: str) -> str:
    """
    Check video codec. If browser-incompatible, transcode to H.264 MP4.
    Returns the path that should be served to the browser.
    """
    codec = _get_codec(video_path)
    ext   = Path(video_path).suffix.lower()
    print(f"[Pipeline] Video codec: '{codec}'  ext: '{ext}'")

    needs_transcode = (
        codec in _NEEDS_TRANSCODE
        or ext in {".avi", ".mov", ".mkv", ".wmv", ".flv", ".mpeg", ".mpg"}
    )

    if not needs_transcode:
        return video_path   # MP4/H.264 — serve directly

    # Save transcoded file to uploads/ alongside original
    src_path      = Path(video_path)
    transcoded    = src_path.parent / f"{session_id}_transcoded.mp4"

    if transcoded.exists():
        return str(transcoded)   # already done from a previous run

    success = _transcode_to_h264(str(src_path), str(transcoded))
    return str(transcoded) if success else video_path


class SurveillancePipeline:

    def __init__(self, session_id: str, alert_agent: AlertAgent):
        self.session_id  = session_id
        self.alert_agent = alert_agent
        self._vision     = VisionAgent(model_size=settings.YOLO_MODEL)
        self._motion     = MotionAgent()
        self._behavior   = BehaviorAgent()
        self._reasoning  = ReasoningAgent()
        self._report     = ReportAgent()
        self._browser_video_path: str = ""   # transcoded path for frontend

    async def process_video(self, video_path: str, on_progress=None) -> List[Incident]:
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {video_path}")

        fps          = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()

        print(f"[Pipeline] Video: {width}x{height} @ {fps:.1f}fps  {total_frames} frames")

        self._motion.reset()
        self._behavior.reset()
        self._reasoning.reset()

        # Transcode if needed for browser playback
        loop = asyncio.get_event_loop()
        self._browser_video_path = await loop.run_in_executor(
            None, _prepare_video_for_browser, video_path, self.session_id
        )

        # Re-open for frame iteration
        cap       = cv2.VideoCapture(video_path)
        frame_idx = 0
        processed = 0
        incidents: List[Incident] = []

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                frame_idx += 1
                if frame_idx % settings.FRAME_SKIP != 0:
                    continue
                processed += 1

                vision, motion = await loop.run_in_executor(
                    _CUDA_EXECUTOR,
                    _run_inference, self._vision, self._motion, frame, frame_idx
                )

                behavior  = self._behavior.analyse(vision, motion, frame_idx)
                reasoning = self._reasoning.evaluate(vision, motion, behavior, frame_idx)

                if reasoning.should_report:
                    ts = _frames_to_timestamp(frame_idx, fps)
                    description = await loop.run_in_executor(
                        None,
                        self._report.generate, ts, vision, motion, behavior, reasoning
                    )
                    frame_path = self._save_frame(
                        vision.annotated_frame if vision.annotated_frame is not None else frame,
                        frame_idx,
                    )
                    incident = Incident(
                        session_id=self.session_id,
                        timestamp=ts,
                        event_type=reasoning.classified_event,
                        severity=reasoning.severity,
                        confidence=reasoning.confidence,
                        description=description,
                        frame_path=frame_path,
                    )
                    incidents.append(incident)
                    await self.alert_agent.dispatch(incident, ["dashboard"])

                if on_progress:
                    await on_progress(
                        processed,
                        max(total_frames // settings.FRAME_SKIP, 1),
                        len(incidents)
                    )

        finally:
            cap.release()

        return incidents

    def _save_frame(self, frame, frame_idx: int) -> str:
        out_dir = Path(settings.OUTPUT_DIR) / self.session_id
        out_dir.mkdir(parents=True, exist_ok=True)
        fname = f"frame_{frame_idx:06d}.jpg"
        path  = str(out_dir / fname)
        cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
        return path
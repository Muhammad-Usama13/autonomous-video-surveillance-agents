"""
agents/vision_agent.py – YOLOv8 object detection agent, GPU-accelerated.

GPU upgrades for RTX 30xx/40xx + CUDA 12:
  - Runs on CUDA device automatically
  - FP16 (half-precision) inference — 2x faster on RTX Tensor Cores
  - cuDNN benchmark mode for fixed-size inputs
  - Larger model (yolov8m) by default for better accuracy
  - Batch-ready: can accept list of frames for future batching
"""
from __future__ import annotations
import cv2
import numpy as np
from typing import List, Any
from dataclasses import dataclass, field

try:
    import torch
    TORCH_AVAILABLE = True
    # PyTorch 2.6+ defaults weights_only=True, which blocks ultralytics models
    _orig_torch_load = torch.load
    def _safe_torch_load(*args, **kwargs):
        if "weights_only" not in kwargs:
            kwargs["weights_only"] = False
        return _orig_torch_load(*args, **kwargs)
    torch.load = _safe_torch_load
except ImportError:
    TORCH_AVAILABLE = False

try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False

from core.config import settings

# ── GPU setup ─────────────────────────────────────────────────────────────────
if TORCH_AVAILABLE and torch.cuda.is_available():
    # cuDNN auto-tuner: finds fastest convolution algorithm for your GPU
    torch.backends.cudnn.benchmark = True
    DEVICE = "cuda"
    GPU_NAME = torch.cuda.get_device_name(0)
    print(f"[GPU] CUDA available — {GPU_NAME}")
    print(f"[GPU] VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
else:
    DEVICE = "cpu"
    print("[GPU] CUDA not available — running on CPU")

# COCO class IDs we care about
PERSON_ID   = 0
VEHICLE_IDS = {2, 3, 5, 7}   # car, motorcycle, bus, truck
OBJECT_IDS  = {24, 26, 28}   # backpack, handbag, suitcase


@dataclass
class Detection:
    label: str
    class_id: int
    confidence: float
    bbox: List[int]      # [x1, y1, x2, y2]
    center: List[int]    # [cx, cy]
    area: int


@dataclass
class VisionResult:
    frame_idx: int
    detections: List[Detection] = field(default_factory=list)
    person_count: int = 0
    vehicle_count: int = 0
    annotated_frame: Any = None   # np.ndarray | None

    @property
    def has_people(self) -> bool:
        return self.person_count > 0


class VisionAgent:
    """
    YOLOv8 object detection running on CUDA with FP16 precision.

    Model size guide (pick in config):
      yolov8n.pt  — fastest,  lowest accuracy  (~80 FPS on RTX 3080)
      yolov8m.pt  — balanced, good accuracy    (~45 FPS on RTX 3080)  ← default
      yolov8l.pt  — slower,   high accuracy    (~25 FPS on RTX 3080)
      yolov8x.pt  — slowest,  best accuracy    (~15 FPS on RTX 3080)
    """

    def __init__(self, model_size: str = "yolov8m.pt"):
        self.model_size = model_size
        self.device     = DEVICE
        # RTX 30xx/40xx support FP16 natively via Tensor Cores
        self.use_fp16   = (DEVICE == "cuda")
        self.model      = None
        self._load_model()

    # ── Setup ─────────────────────────────────────────────────────────────

    def _load_model(self):
        if not YOLO_AVAILABLE:
            print("[VisionAgent] ultralytics not installed — stub mode.")
            return
        try:
            from pathlib import Path
            p = Path(self.model_size)
            if not p.exists():
                backend_p = Path(__file__).parent.parent / self.model_size
                if backend_p.exists():
                    self.model_size = str(backend_p)
            self.model = YOLO(self.model_size)
            self.model.to(self.device)
            # Do NOT call model.model.half() manually — ultralytics handles
            # FP16 internally via the half= param in the inference call.
            # Manually calling .half() on weights causes dtype mismatches.
            print(f"[VisionAgent] {self.model_size} loaded on {self.device} (FP16 via inference ✓)")
        except Exception as e:
            print(f"[VisionAgent] Model load failed: {e}. Stub mode.")

    # ── Public API ────────────────────────────────────────────────────────

    def detect(self, frame: np.ndarray, frame_idx: int = 0) -> VisionResult:
        """Run GPU-accelerated detection on a single BGR frame."""
        if self.model is None:
            return self._stub_detect(frame, frame_idx)

        results = self.model(
            frame,
            conf=settings.CONFIDENCE_THRESHOLD,
            device=self.device,
            half=self.use_fp16,    # FP16 inference on RTX Tensor Cores
            verbose=False,
            imgsz=640,             # standard YOLO input size
        )[0]

        detections: List[Detection] = []
        for box in results.boxes:
            cls_id      = int(box.cls[0])
            conf        = float(box.conf[0])
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            label       = results.names[cls_id]
            detections.append(Detection(
                label=label,
                class_id=cls_id,
                confidence=conf,
                bbox=[x1, y1, x2, y2],
                center=[(x1 + x2) // 2, (y1 + y2) // 2],
                area=(x2 - x1) * (y2 - y1),
            ))

        annotated = self.annotate_frame(frame.copy(), detections, is_anomaly=False)

        return VisionResult(
            frame_idx=frame_idx,
            detections=detections,
            person_count=sum(1 for d in detections if d.class_id == PERSON_ID),
            vehicle_count=sum(1 for d in detections if d.class_id in VEHICLE_IDS),
            annotated_frame=annotated,
        )

    # ── High-Tech HUD & Bounding Box Annotation ───────────────────────────

    def annotate_frame(
        self,
        frame: np.ndarray,
        detections: List[Detection],
        is_anomaly: bool = False,
        event_type: str = "normal",
        confidence: float = 0.0,
        timestamp: str = "",
    ) -> np.ndarray:
        """
        Draws high-contrast surveillance bounding boxes:
          - GREEN for Normal behavior
          - RED for Abnormal / Alert behavior
        Includes HUD overlay, filled label pill, and corner brackets.
        """
        h, w = frame.shape[:2]
        canvas = frame.copy()

        # Color scheme (BGR)
        if is_anomaly:
            box_color   = (30, 30, 240)    # Vivid Red
            glow_color  = (50, 50, 255)    # Outer accent
            badge_bg    = (20, 20, 180)    # Deep Red badge
            text_color  = (255, 255, 255)  # White text
            status_text = f"ALERT: {event_type.replace('_', ' ').upper()}"
            status_bg   = (15, 15, 190)
        else:
            box_color   = (80, 220, 0)     # Vivid Green
            glow_color  = (120, 255, 50)   # Outer accent
            badge_bg    = (20, 130, 0)     # Deep Green badge
            text_color  = (255, 255, 255)  # White text
            status_text = "MONITORING: NORMAL ACTIVITY"
            status_bg   = (10, 80, 10)

        # 1. Draw detections
        for d in detections:
            x1, y1, x2, y2 = d.bbox
            bw = x2 - x1
            bh = y2 - y1

            # Primary rectangle
            cv2.rectangle(canvas, (x1, y1), (x2, y2), box_color, 2, cv2.LINE_AA)

            # High-tech corner bracket accents (length = 15% of dimension)
            corner_len = max(8, min(18, int(min(bw, bh) * 0.2)))
            # Top-left
            cv2.line(canvas, (x1, y1), (x1 + corner_len, y1), glow_color, 3, cv2.LINE_AA)
            cv2.line(canvas, (x1, y1), (x1, y1 + corner_len), glow_color, 3, cv2.LINE_AA)
            # Top-right
            cv2.line(canvas, (x2, y1), (x2 - corner_len, y1), glow_color, 3, cv2.LINE_AA)
            cv2.line(canvas, (x2, y1), (x2, y1 + corner_len), glow_color, 3, cv2.LINE_AA)
            # Bottom-left
            cv2.line(canvas, (x1, y2), (x1 + corner_len, y2), glow_color, 3, cv2.LINE_AA)
            cv2.line(canvas, (x1, y2), (x1, y2 - corner_len), glow_color, 3, cv2.LINE_AA)
            # Bottom-right
            cv2.line(canvas, (x2, y2), (x2 - corner_len, y2), glow_color, 3, cv2.LINE_AA)
            cv2.line(canvas, (x2, y2), (x2, y2 - corner_len), glow_color, 3, cv2.LINE_AA)

            # Pill Label badge: e.g. [NORMAL] Person 88% or [ALERT] Person 92%
            tag_prefix = "ABNORMAL" if is_anomaly else "NORMAL"
            label_str = f"[{tag_prefix}] {d.label.capitalize()} {int(d.confidence * 100)}%"
            (txt_w, txt_h), baseline = cv2.getTextSize(
                label_str, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1
            )
            
            badge_y1 = max(0, y1 - txt_h - 8)
            badge_y2 = y1
            badge_x2 = min(w - 1, x1 + txt_w + 10)
            
            # Draw badge background
            cv2.rectangle(canvas, (x1, badge_y1), (badge_x2, badge_y2), badge_bg, -1)
            cv2.rectangle(canvas, (x1, badge_y1), (badge_x2, badge_y2), box_color, 1)
            cv2.putText(
                canvas, label_str, (x1 + 5, badge_y2 - 4),
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, text_color, 1, cv2.LINE_AA
            )

        # 2. Top-Left HUD Status Banner
        banner_h = 32
        banner_w = min(w - 20, 360 if is_anomaly else 300)
        cv2.rectangle(canvas, (10, 10), (10 + banner_w, 10 + banner_h), status_bg, -1)
        cv2.rectangle(canvas, (10, 10), (10 + banner_w, 10 + banner_h), box_color, 2)
        
        dot_color = (0, 0, 255) if is_anomaly else (0, 255, 0)
        cv2.circle(canvas, (24, 10 + banner_h // 2), 5, dot_color, -1)
        
        hud_label = f"{status_text} | {len(detections)} OBJECTS"
        if timestamp:
            hud_label += f" | {timestamp}"
        cv2.putText(
            canvas, hud_label, (36, 10 + banner_h // 2 + 5),
            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1, cv2.LINE_AA
        )

        return canvas

    def _draw_boxes(self, frame: np.ndarray, detections: List[Detection]) -> np.ndarray:
        return self.annotate_frame(frame, detections, is_anomaly=False)

    def _stub_detect(self, frame: np.ndarray, frame_idx: int) -> VisionResult:
        annotated = self.annotate_frame(frame.copy(), [], is_anomaly=False)
        return VisionResult(frame_idx=frame_idx, annotated_frame=annotated)

    # ── Diagnostics ───────────────────────────────────────────────────────

    @staticmethod
    def gpu_info() -> dict:
        if not TORCH_AVAILABLE or not torch.cuda.is_available():
            return {"device": "cpu"}
        props = torch.cuda.get_device_properties(0)
        return {
            "device":       DEVICE,
            "name":         props.name,
            "vram_gb":      round(props.total_memory / 1e9, 1),
            "cuda_version": torch.version.cuda,
            "fp16":         True,
        }
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

        annotated = self._draw_boxes(frame.copy(), detections)

        return VisionResult(
            frame_idx=frame_idx,
            detections=detections,
            person_count=sum(1 for d in detections if d.class_id == PERSON_ID),
            vehicle_count=sum(1 for d in detections if d.class_id in VEHICLE_IDS),
            annotated_frame=annotated,
        )

    # ── Internals ─────────────────────────────────────────────────────────

    def _draw_boxes(self, frame: np.ndarray, detections: List[Detection]) -> np.ndarray:
        color_map = {
            "person":     (0, 255, 128),
            "car":        (255, 160, 0),
            "motorcycle": (255, 80, 0),
            "bus":        (255, 80, 0),
            "truck":      (255, 80, 0),
        }
        for d in detections:
            color = color_map.get(d.label, (200, 200, 200))
            x1, y1, x2, y2 = d.bbox
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            label_txt = f"{d.label} {d.confidence:.2f}"
            cv2.putText(frame, label_txt, (x1, y1 - 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 1)
        return frame

    def _stub_detect(self, frame: np.ndarray, frame_idx: int) -> VisionResult:
        return VisionResult(frame_idx=frame_idx, annotated_frame=frame.copy())

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
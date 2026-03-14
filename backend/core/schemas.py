"""
core/schemas.py – Pydantic schemas for API I/O
"""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class Incident(BaseModel):
    id: Optional[int] = None
    session_id: str
    timestamp: str
    event_type: str
    severity: str          # low | medium | high | critical
    confidence: float
    description: str
    frame_path: Optional[str] = None
    clip_path: Optional[str] = None
    alert_sent: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SessionStatus(BaseModel):
    session_id: str
    video_name: str
    status: str
    total_frames: int
    processed: int
    incidents: int
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    progress_pct: float = 0.0

    class Config:
        from_attributes = True


class AnalysisResult(BaseModel):
    session_id: str
    video_name: str
    duration_seconds: float
    total_frames: int
    incidents: List[Incident]
    summary: str


class AlertPayload(BaseModel):
    session_id: str
    incident_id: int
    channel: str = "dashboard"   # dashboard | email | both


class WSMessage(BaseModel):
    type: str          # progress | incident | done | error
    data: dict

"""
main.py – FastAPI application entry point.

Routes:
  POST   /api/upload          – Upload video & start analysis
  GET    /api/sessions        – List all sessions
  GET    /api/sessions/{id}   – Session status
  GET    /api/incidents       – List incidents (filterable)
  GET    /api/incidents/{id}  – Single incident
  DELETE /api/sessions/{id}   – Remove session
  WS     /ws/{session_id}     – Real-time progress & alerts
  GET    /outputs/{path}      – Serve saved frames/clips
  GET    /uploads/{path}      – Serve original uploaded videos
"""
import warnings
# Suppress torch.load FutureWarning from ultralytics (safe — we trust our own weights)
warnings.filterwarnings(
    "ignore",
    message=".*weights_only.*",
    category=FutureWarning,
    module="ultralytics.*",
)
warnings.filterwarnings(
    "ignore",
    message=".*torch.load.*",
    category=FutureWarning,
)

# PyTorch 2.6+ defaults weights_only=True, which breaks ultralytics YOLO model unpickling
try:
    import torch
    _orig_torch_load = torch.load
    def _safe_torch_load(*args, **kwargs):
        if "weights_only" not in kwargs:
            kwargs["weights_only"] = False
        return _orig_torch_load(*args, **kwargs)
    torch.load = _safe_torch_load
except Exception:
    pass

import uuid
import asyncio
import aiofiles
import os
import mimetypes
import subprocess
import shutil
from pathlib import Path
from datetime import datetime
from typing import Optional, List

from fastapi import (
    FastAPI, UploadFile, File, WebSocket, WebSocketDisconnect,
    Depends, HTTPException, BackgroundTasks, Query, Request
)
from fastapi.responses import StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update

from core.config import settings
from core.database import init_db, get_db, SessionModel, IncidentModel
from core.schemas import SessionStatus, Incident, AnalysisResult
from core.pipeline import SurveillancePipeline
from agents.alert_agent import AlertAgent


# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Autonomous Video Surveillance API",
    version="1.0.0",
    description="AI-powered multi-agent surveillance analysis system",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Singleton alert agent (shared across requests)
alert_agent = AlertAgent()


@app.on_event("startup")
async def startup():
    await init_db()
    Path(settings.UPLOAD_DIR).mkdir(exist_ok=True)
    Path(settings.OUTPUT_DIR).mkdir(exist_ok=True)
    # Mount static dirs after ensuring they exist
    if not any(r.name == "outputs" for r in app.routes):
        app.mount("/outputs", StaticFiles(directory=settings.OUTPUT_DIR), name="outputs")
    if not any(r.name == "uploads" for r in app.routes):
        app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")


# ── WebSocket ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/{session_id}")
async def ws_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    alert_agent.register_ws(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        alert_agent.unregister_ws(websocket)


# ── Helpers ───────────────────────────────────────────────────────────────────

FFMPEG_AVAILABLE = shutil.which("ffmpeg") is not None

def _needs_transcode(video_path: Path) -> bool:
    """Return True if the video needs transcoding for browser playback."""
    suffix = video_path.suffix.lower()
    # AVI, MOV, MKV always need transcode — browsers can't play them
    if suffix in (".avi", ".mov", ".mkv"):
        return True
    # MP4/WebM: check codec via ffprobe
    if not shutil.which("ffprobe"):
        return False
    try:
        result = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "v:0",
             "-show_entries", "stream=codec_name",
             "-of", "default=noprint_wrappers=1:nokey=1",
             str(video_path)],
            capture_output=True, text=True, timeout=10
        )
        codec = result.stdout.strip().lower()
        # Only h264 and vp8/vp9 play natively in browsers
        return codec not in ("h264", "vp8", "vp9", "av1")
    except Exception:
        return False


async def _transcode_for_browser(src: Path, dst: Path) -> bool:
    """
    Transcode to H.264 MP4 with AAC audio — universally browser-compatible.
    Uses -crf 23 (visually lossless), -preset fast for speed on RTX GPU.
    Returns True on success, False on failure.
    """
    if not FFMPEG_AVAILABLE:
        return False
    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", str(src),
            "-c:v", "libx264",
            "-crf", "23",           # quality: 0=lossless, 51=worst, 23=default
            "-preset", "fast",      # encoding speed vs compression tradeoff
            "-profile:v", "high",
            "-level", "4.1",
            "-pix_fmt", "yuv420p",  # required for broad browser compat
            "-movflags", "+faststart",  # move moov atom to front for streaming
            "-c:a", "aac",
            "-b:a", "128k",
            "-vsync", "cfr",        # constant frame rate — fixes VFR AVI issues
            str(dst)
        ]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)
        if proc.returncode != 0:
            print(f"[Transcode] FFmpeg error: {stderr.decode()[-500:]}")
            return False
        print(f"[Transcode] Done: {dst.name} ({dst.stat().st_size / 1e6:.1f} MB)")
        return True
    except asyncio.TimeoutError:
        print("[Transcode] Timed out after 10 minutes")
        return False
    except Exception as e:
        print(f"[Transcode] Error: {e}")
        return False


# ── Upload & Analyse ──────────────────────────────────────────────────────────

@app.post("/api/upload", response_model=SessionStatus)
async def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.lower().endswith((".mp4", ".avi", ".mov", ".mkv", ".webm")):
        raise HTTPException(400, "Unsupported file format. Use MP4, AVI, MOV, MKV, or WebM.")

    session_id  = str(uuid.uuid4())
    orig_path   = Path(settings.UPLOAD_DIR) / f"{session_id}_{file.filename}"

    # Stream original file to disk
    async with aiofiles.open(orig_path, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            await f.write(chunk)

    # Transcode to H.264 MP4 for browser playback (async, non-blocking)
    web_path = Path(settings.UPLOAD_DIR) / f"{session_id}_web.mp4"
    if _needs_transcode(orig_path) and FFMPEG_AVAILABLE:
        print(f"[Transcode] Starting: {file.filename} → {web_path.name}")
        asyncio.create_task(_transcode_for_browser(orig_path, web_path))
    elif not _needs_transcode(orig_path):
        # Already browser-compatible — symlink or copy as web version
        import shutil as _sh
        _sh.copy2(str(orig_path), str(web_path))

    # Create DB session record
    session = SessionModel(
        session_id=session_id,
        video_name=file.filename,
        status="processing",
    )
    db.add(session)
    await db.commit()

    # Analysis runs on the original file (full quality for AI)
    background_tasks.add_task(
        run_analysis, session_id, str(orig_path), file.filename
    )

    return SessionStatus(
        session_id=session_id,
        video_name=file.filename,
        status="processing",
        total_frames=0,
        processed=0,
        incidents=0,
        started_at=datetime.utcnow(),
        progress_pct=0.0,
    )


# ── Background task ───────────────────────────────────────────────────────────

async def run_analysis(session_id: str, video_path: str, video_name: str):
    """Background task: run the full pipeline and persist results."""
    pipeline = SurveillancePipeline(session_id, alert_agent)

    async def on_progress(processed: int, total: int, incident_count: int):
        pct = round(processed / max(total, 1) * 100, 1)
        await alert_agent.push_ws({
            "type": "progress",
            "data": {
                "session_id": session_id,
                "processed": processed,
                "total": total,
                "incidents": incident_count,
                "progress_pct": pct,
            }
        })
        # Update DB
        async with AsyncSession(bind=None) as _:
            pass   # lightweight; full update at completion

    try:
        incidents = await pipeline.process_video(video_path, on_progress)

        # Persist incidents
        from core.database import AsyncSessionLocal, SessionModel, IncidentModel
        async with AsyncSessionLocal() as db:
            for inc in incidents:
                db.add(IncidentModel(
                    session_id=inc.session_id,
                    timestamp=inc.timestamp,
                    event_type=inc.event_type,
                    severity=inc.severity,
                    confidence=inc.confidence,
                    description=inc.description,
                    frame_path=inc.frame_path,
                    alert_sent=True,
                ))

            # Update session status
            result = await db.execute(
                select(SessionModel).where(SessionModel.session_id == session_id)
            )
            sess = result.scalar_one_or_none()
            if sess:
                sess.status = "done"
                sess.incidents = len(incidents)
                sess.finished_at = datetime.utcnow()

            await db.commit()

        await alert_agent.push_ws({
            "type": "done",
            "data": {
                "session_id": session_id,
                "incidents": len(incidents),
            }
        })

    except Exception as e:
        print(f"[Pipeline] Error for session {session_id}: {e}")
        from core.database import AsyncSessionLocal, SessionModel
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(SessionModel).where(SessionModel.session_id == session_id)
            )
            sess = result.scalar_one_or_none()
            if sess:
                sess.status = "error"
                await db.commit()

        await alert_agent.push_ws({
            "type": "error",
            "data": {"session_id": session_id, "message": str(e)}
        })


# ── Sessions ──────────────────────────────────────────────────────────────────

@app.get("/api/sessions", response_model=List[SessionStatus])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SessionModel).order_by(SessionModel.started_at.desc()))
    sessions = result.scalars().all()
    out = []
    for s in sessions:
        pct = 0.0
        if s.status == "done":
            pct = 100.0
        out.append(SessionStatus(
            session_id=s.session_id,
            video_name=s.video_name,
            status=s.status,
            total_frames=s.total_frames,
            processed=s.processed,
            incidents=s.incidents,
            started_at=s.started_at,
            finished_at=s.finished_at,
            progress_pct=pct,
        ))
    return out


@app.get("/api/sessions/{session_id}", response_model=SessionStatus)
async def get_session(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionModel).where(SessionModel.session_id == session_id)
    )
    sess = result.scalar_one_or_none()
    if not sess:
        raise HTTPException(404, "Session not found")
    return SessionStatus(
        session_id=sess.session_id,
        video_name=sess.video_name,
        status=sess.status,
        total_frames=sess.total_frames,
        processed=sess.processed,
        incidents=sess.incidents,
        started_at=sess.started_at,
        finished_at=sess.finished_at,
        progress_pct=100.0 if sess.status == "done" else 0.0,
    )


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SessionModel).where(SessionModel.session_id == session_id)
    )
    sess = result.scalar_one_or_none()
    if not sess:
        raise HTTPException(404, "Session not found")
    await db.delete(sess)
    await db.commit()
    return {"deleted": session_id}


@app.get("/api/video/{session_id}")
async def stream_video(session_id: str, request: Request, annotated: bool = False):
    """
    Streams the browser-compatible H.264 MP4 version of the uploaded video.
    If annotated=True and an annotated version exists, stream that instead.
    Supports Range requests for seeking/scrubbing in HTML5 <video>.
    """
    upload_dir = Path(settings.UPLOAD_DIR)

    # Check for annotated version if requested
    annotated_path = upload_dir / f"{session_id}_annotated_web.mp4"
    web_path = upload_dir / f"{session_id}_web.mp4"

    if annotated and annotated_path.exists() and annotated_path.stat().st_size > 0:
        video_path = annotated_path
    elif web_path.exists() and web_path.stat().st_size > 0:
        video_path = web_path
    else:
        # Fallback to original
        video_path = None
        for f in upload_dir.glob(f"{session_id}_*"):
            if "_web.mp4" not in f.name and "_annotated" not in f.name:
                video_path = f
                break

    if not video_path or not video_path.exists():
        raise HTTPException(404, "Video file not found")

    file_size = video_path.stat().st_size
    mime_type = "video/mp4" if video_path.suffix == ".mp4" else "video/x-msvideo"

    range_header = request.headers.get("range")
    if range_header:
        try:
            range_val        = range_header.strip().replace("bytes=", "")
            start_str, end_str = range_val.split("-")
            start = int(start_str)
            end   = int(end_str) if end_str else file_size - 1
        except Exception:
            start, end = 0, file_size - 1
    else:
        start, end = 0, file_size - 1

    end   = min(end, file_size - 1)
    chunk = end - start + 1

    async def file_iterator(path: Path, s: int, length: int):
        async with aiofiles.open(path, "rb") as f:
            await f.seek(s)
            remaining = length
            while remaining > 0:
                read_size = min(1024 * 256, remaining)
                data = await f.read(read_size)
                if not data:
                    break
                remaining -= len(data)
                yield data

    headers = {
        "Content-Range":  f"bytes {start}-{end}/{file_size}",
        "Accept-Ranges":  "bytes",
        "Content-Length": str(chunk),
        "Content-Type":   mime_type,
        "Cache-Control":  "no-cache",
    }

    return StreamingResponse(
        file_iterator(video_path, start, chunk),
        status_code=206 if range_header else 200,
        headers=headers,
        media_type=mime_type,
    )


@app.get("/api/sessions/{session_id}/video-info")
async def session_video_info(session_id: str, db: AsyncSession = Depends(get_db)):
    """
    Returns URLs for the original uploaded video, annotated video stream,
    all annotated incident frames, and a structured AI summary for the VideoPlayer page.
    """
    result = await db.execute(
        select(SessionModel).where(SessionModel.session_id == session_id)
    )
    sess = result.scalar_one_or_none()
    if not sess:
        raise HTTPException(404, "Session not found")

    # Find video — use the streaming endpoint (handles Range requests properly)
    upload_dir = Path(settings.UPLOAD_DIR)
    video_url  = None
    web_ready  = False

    # Check if web-compatible H.264 version exists
    web_path = upload_dir / f"{session_id}_web.mp4"
    if web_path.exists() and web_path.stat().st_size > 0:
        web_ready = True
        video_url = f"/api/video/{session_id}"

    # Check if annotated version with YOLO bounding boxes exists
    annotated_path = upload_dir / f"{session_id}_annotated_web.mp4"
    has_annotated  = annotated_path.exists() and annotated_path.stat().st_size > 0
    annotated_url  = f"/api/video/{session_id}?annotated=true" if has_annotated else None

    # Get all incidents for this session with frame paths
    inc_result = await db.execute(
        select(IncidentModel)
        .where(IncidentModel.session_id == session_id)
        .order_by(IncidentModel.created_at)
    )
    incidents = inc_result.scalars().all()

    # Build timeline entries
    timeline = []
    for inc in incidents:
        frame_url = None
        if inc.frame_path:
            # Convert absolute path to URL
            p = Path(inc.frame_path)
            try:
                rel = p.relative_to(Path(settings.OUTPUT_DIR))
                frame_url = f"/outputs/{rel}"
            except ValueError:
                frame_url = f"/outputs/{p.name}"

        timeline.append({
            "id":          inc.id,
            "timestamp":   inc.timestamp,
            "event_type":  inc.event_type,
            "severity":    inc.severity,
            "confidence":  inc.confidence,
            "description": inc.description,
            "frame_url":   frame_url,
        })

    # Build AI summary text
    if incidents:
        event_counts: dict = {}
        for inc in incidents:
            event_counts[inc.event_type] = event_counts.get(inc.event_type, 0) + 1
        top_events = sorted(event_counts.items(), key=lambda x: x[1], reverse=True)
        critical   = [i for i in incidents if i.severity == "critical"]
        high       = [i for i in incidents if i.severity == "high"]

        summary = (
            f"Analysis of '{sess.video_name}' detected {len(incidents)} incident(s) across "
            f"{len(event_counts)} event type(s). "
        )
        if critical:
            summary += f"{len(critical)} CRITICAL event(s) require immediate attention. "
        if high:
            summary += f"{len(high)} HIGH severity event(s) were flagged. "
        summary += f"Most frequent: '{top_events[0][0].replace('_',' ')}' ({top_events[0][1]}x). "
        summary += f"Review the incident timeline below for detailed descriptions at each timestamp."
    else:
        summary = f"No anomalies were detected in '{sess.video_name}'. The footage appears normal."

    return {
        "session_id":          session_id,
        "video_name":          sess.video_name,
        "status":              sess.status,
        "video_url":           video_url,
        "annotated_video_url": annotated_url,
        "has_annotated":       has_annotated,
        "web_ready":           web_ready,        # True = H.264 MP4 ready for browser
        "timeline":            timeline,
        "summary":             summary,
        "total_incidents":     len(incidents),
        "started_at":          sess.started_at.isoformat() if sess.started_at else None,
        "finished_at":         sess.finished_at.isoformat() if sess.finished_at else None,
    }


# ── Incidents ─────────────────────────────────────────────────────────────────

@app.get("/api/incidents", response_model=List[Incident])
async def list_incidents(
    session_id: Optional[str] = Query(None),
    severity: Optional[str]   = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(IncidentModel).order_by(IncidentModel.created_at.desc())
    if session_id:
        query = query.where(IncidentModel.session_id == session_id)
    if severity:
        query = query.where(IncidentModel.severity == severity)
    result = await db.execute(query)
    rows = result.scalars().all()
    return [
        Incident(
            id=r.id,
            session_id=r.session_id,
            timestamp=r.timestamp,
            event_type=r.event_type,
            severity=r.severity,
            confidence=r.confidence,
            description=r.description,
            frame_path=r.frame_path,
            clip_path=r.clip_path,
            alert_sent=r.alert_sent,
            created_at=r.created_at,
        )
        for r in rows
    ]


@app.get("/api/incidents/{incident_id}", response_model=Incident)
async def get_incident(incident_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(IncidentModel).where(IncidentModel.id == incident_id)
    )
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(404, "Incident not found")
    return Incident(
        id=row.id,
        session_id=row.session_id,
        timestamp=row.timestamp,
        event_type=row.event_type,
        severity=row.severity,
        confidence=row.confidence,
        description=row.description,
        frame_path=row.frame_path,
        clip_path=row.clip_path,
        alert_sent=row.alert_sent,
        created_at=row.created_at,
    )


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


# ── GPU Info ──────────────────────────────────────────────────────────────────

@app.get("/api/gpu-info")
async def gpu_info():
    """Returns GPU status — useful for the dashboard system panel."""
    try:
        import torch
        if torch.cuda.is_available():
            props     = torch.cuda.get_device_properties(0)
            allocated = torch.cuda.memory_allocated(0)
            reserved  = torch.cuda.memory_reserved(0)
            return {
                "available":        True,
                "name":             props.name,
                "vram_total_gb":    round(props.total_memory / 1e9, 1),
                "vram_used_gb":     round(allocated / 1e9, 3),
                "vram_reserved_gb": round(reserved / 1e9, 3),
                "cuda_version":     torch.version.cuda,
                "pytorch":          torch.__version__,
                "fp16":             True,
                "yolo_model":       settings.YOLO_MODEL,
                "motion_backend":   "sea_raft",        # upgraded from RAFT
                "flow_model":       "SEA-RAFT-M (ECCV 2024)",
            }
        return {"available": False, "reason": "CUDA not detected"}
    except ImportError:
        return {"available": False, "reason": "PyTorch not installed"}


# ── Dev runner ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import os, sys
    # Ensure the backend directory is always on sys.path,
    # including inside uvicorn's reloader subprocess
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)
    os.environ.setdefault("PYTHONPATH", backend_dir)

    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        reload_dirs=[backend_dir],
    )

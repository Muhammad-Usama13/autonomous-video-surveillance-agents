<div align="center">

<h1>
  <img src="https://img.shields.io/badge/AVSA-Autonomous%20Video%20Surveillance%20Agents-00e5ff?style=for-the-badge&labelColor=0a0d12" alt="AVSA"/>
</h1>

<p align="center">
  <strong>A production-grade, multi-agent AI surveillance system that autonomously detects, classifies, and reports anomalous behaviour in video streams — in real time.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white"/>
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black"/>
  <img src="https://img.shields.io/badge/YOLOv8m-Ultralytics-FF6600?style=flat-square"/>
  <img src="https://img.shields.io/badge/SEA--RAFT-ECCV%202024-00e5ff?style=flat-square"/>
  <img src="https://img.shields.io/badge/Gemini-1.5%20Flash-4285F4?style=flat-square&logo=google&logoColor=white"/>
  <img src="https://img.shields.io/badge/CUDA-12.x-76B900?style=flat-square&logo=nvidia&logoColor=white"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square"/>
</p>

</div>

---

## Overview

AVSA is an end-to-end AI surveillance platform built on a **collaborative multi-agent architecture**. Rather than a monolithic model, six specialised agents each own a distinct responsibility — object detection, motion analysis, behaviour classification, threat reasoning, natural-language reporting, and alert dispatch — and communicate through a shared async pipeline.

The system was designed to solve the core limitations of traditional CCTV monitoring:

| Problem | AVSA Solution |
|---|---|
| Operators miss events due to fatigue | Fully autonomous 24/7 detection |
| Fixed thresholds fail across different cameras | Per-video adaptive baseline learning |
| Frame-level false positives | Sustained counter confirmation (5+ consecutive frames) |
| Incompatible video formats | Automatic FFmpeg H.264 transcoding |
| No context in alerts | Gemini LLM generates natural-language incident reports |
| Delayed notification | Sub-second WebSocket push to dashboard |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VIDEO INPUT LAYER                            │
│   Uploaded File (MP4/AVI/MOV/MKV) ──► FFmpeg Transcode ──► H.264    │
└───────────────────────────┬─────────────────────────────────────────┘
                            │  Frame extraction (FRAME_SKIP=3)
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    GPU INFERENCE LAYER  (CUDA Thread)               │
│                                                                     │
│  ┌─────────────────────────┐    ┌──────────────────────────────┐    │
│  │     Vision Agent        │    │       Motion Agent           │    │
│  │  YOLOv8m · FP16 · CUDA  │    │   SEA-RAFT · FP32 · CUDA    │     │
│  │                         │    │                              │    │
│  │  • Person detection     │    │  • Dense optical flow        │    │
│  │  • Vehicle detection    │    │  • p75 non-zero magnitude    │    │
│  │  • Bounding boxes       │    │  • Sudden spike detection    │    │
│  │  • Annotated frames     │    │  • Dominant direction        │    │
│  └────────────┬────────────┘    └──────────────┬───────────────┘    │
└───────────────┼────────────────────────────────┼────────────────────┘
                └────────────────┬───────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   BEHAVIOUR ANALYSIS LAYER                          │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     Behavior Agent                           │   │
│  │                                                              │   │
│  │  Adaptive Baseline Learning (first 20 frames)                │   │
│  │  baseline_mean, baseline_std ← p75 of motion magnitudes      │   │
│  │                                                              │   │
│  │  Rule Engine (all thresholds = baseline_mean + N×std):       │   │
│  │  ┌──────────────────┬────────────────────────────────────┐   │   │
│  │  │ Rule             │ Condition                          │   │   │
│  │  ├──────────────────┼────────────────────────────────────┤   │   │
│  │  │ overcrowding     │ persons ≥ 10 for 5 frames          │   │   │
│  │  │ crowd_gathering  │ 4–9 persons, motion < mean+0.3σ    │   │   │
│  │  │ crowd_panic      │ persons ≥ 4, motion > mean+3σ,     │   │   │
│  │  │                  │ sudden_motion=True                 │   │   │
│  │  │ fight_aggression │ sudden_motion, max > mean+3σ       │   │   │ 
│  │  │ loitering        │ 1 person, motion < 0.8×mean, 40f   │   │   │
│  │  └──────────────────┴────────────────────────────────────┘   │   │
│  │                                                              │   │
│  │  Sustained Counter: each rule has independent counter        │   │
│  │  → fires only when condition met for SUSTAIN_FRAMES=5        │   │
│  │  → resets after firing (natural debounce, no cooldown clash) │   │
│  └────────────────────────────────┬─────────────────────────────┘   │
└───────────────────────────────────┼─────────────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     REASONING & OUTPUT LAYER                        │
│                                                                     │
│  ┌────────────────────┐    ┌──────────────────┐   ┌─────────────┐   │
│  │   Reasoning Agent  │    │   Report Agent   │   │ Alert Agent │   │
│  │                    │───►│                  │   │             │   │
│  │ • Weighted score   │    │  Google Gemini   │   │ WebSocket   │   │
│  │ • Dedup window     │    │  2.5 Flash LLM   │   │ SMTP Email  │   │
│  │ • should_report    │    │                  │   │             │   │
│  │   decision         │    │  Natural-language│   │ Rate-limited│   │
│  └────────────────────┘    │  incident report │   │ per event   │   │
│                            └────────┬─────────┘   └──────┬──────┘   │
└─────────────────────────────────────┼────────────────────┼──────────┘
                                      ▼                    ▼
                              ┌───────────────────────────────┐
                              │   SQLite Database (async ORM) │
                              │   Incident records + frames   │
                              └───────────────────────────────┘
```

---

## Tech Stack

### Backend
| Component | Technology | Notes |
|---|---|---|
| API Framework | FastAPI 0.111 + Uvicorn | Async, WebSocket support |
| Object Detection | YOLOv8m (Ultralytics) | CUDA FP16, ~140 FPS on RTX 3080 |
| Optical Flow | **SEA-RAFT** (ECCV 2024) | CUDA FP32, 22.9% better than RAFT |
| LLM Reporting | Google Gemini 1.5 Flash | Natural-language incident reports |
| Video Transcoding | FFmpeg | AVI/MOV/MKV → H.264 MP4 |
| Database | SQLAlchemy async + SQLite | Incidents, sessions, frames |
| Config | Pydantic-settings | `.env` driven, type-safe |

### Frontend
| Component | Technology |
|---|---|
| Framework | React 18 + Vite |
| Styling | Tailwind CSS + custom design system |
| Charts | Recharts |
| Routing | React Router v6 |
| Real-time | Native WebSocket hook |

### Hardware Requirements
| Tier | Spec | Performance |
|---|---|---|
| Minimum | NVIDIA GTX 1060 6GB + CUDA 11 | ~15 FPS pipeline |
| Recommended | NVIDIA RTX 3080 + CUDA 12 | ~60 FPS pipeline |
| Tested On | NVIDIA RTX 4050 Laptop 6GB | ~45 FPS pipeline |

---

## Key Design Decisions

### 1. SEA-RAFT over RAFT for Optical Flow

SEA-RAFT (Simple, Efficient, Accurate RAFT, ECCV 2024 Oral — Best Paper Award Candidate) was chosen over the original RAFT model for three reasons:

- **22.9% lower endpoint error** on the Spring benchmark (3.69 EPE vs RAFT's 4.78)
- **2.3× faster inference** — critical for real-time video processing
- **Uncertainty output** — the `info` tensor provides per-pixel flow confidence, enabling smarter anomaly weighting

SEA-RAFT is loaded via `importlib` with isolated module registration in `sys.modules` to avoid namespace conflicts with our own `core/` package — a non-trivial integration challenge solved through careful module surgery.

### 2. Adaptive Baseline Learning

Rather than hardcoded motion thresholds (which break across different cameras, resolutions, and codecs), the `BehaviorAgent` learns the statistical profile of "normal" motion from the **first 20 processed frames** of each video:

```python
baseline_mean = p75(non_zero_magnitudes[:20_frames])
baseline_std  = std(non_zero_magnitudes[:20_frames])
# All thresholds expressed as: baseline_mean + N × baseline_std
```

This makes the system **automatically calibrate** to:
- 320×240 low-resolution CCTV (Farneback: mean ≈ 0.32)
- 1080p high-resolution footage (SEA-RAFT: mean ≈ 2–6)
- Static cameras vs. PTZ cameras
- Different video codecs (H.264, MPEG-4, FMP4)

The 75th percentile of non-zero pixels is used instead of the mean because SEA-RAFT produces sparse high-magnitude vectors over moving subjects against a large zero-motion background — mean magnitude gets crushed to ~0.2 by background pixels, while p75 correctly captures the ~2–6 range of actual motion.

### 3. Sustained Counter Architecture

The `BehaviorAgent` uses per-behavior **sustained counters** instead of a vote buffer + cooldown mechanism. The original design had a fundamental conflict: cooldown timers reset the vote buffer before it could fill, producing zero detections even when anomalies were continuously present.

```python
# Each behavior has an independent counter
counters["overcrowding"] += 1   # increments each frame condition is met
# Fires only when counter reaches SUSTAIN_FRAMES=5 (≈0.5s at FRAME_SKIP=3)
# Counter resets after firing — natural debounce without cooldown conflict
```

### 4. Browser Video Streaming

HTML5 `<video>` requires `Range` request support for seeking and duration detection. The system implements a proper streaming endpoint (`/api/video/{session_id}`) that:
- Serves the H.264-transcoded version for browser compatibility
- Handles `Range: bytes=X-Y` headers returning `206 Partial Content`
- Falls back to the original file if transcoding is still in progress

---

## Project Structure

```
surveillance/
├── backend/
│   ├── agents/
│   │   ├── vision_agent.py      # YOLOv8m · CUDA FP16 · bounding box detection
│   │   ├── motion_agent.py      # SEA-RAFT · CUDA FP32 · adaptive p75 magnitude
│   │   ├── behavior_agent.py    # Sustained-counter anomaly classifier
│   │   ├── reasoning_agent.py   # Threat scoring · deduplication · report gating
│   │   ├── report_agent.py      # Gemini 1.5 Flash · natural-language reports
│   │   └── alert_agent.py       # WebSocket push · SMTP email · rate limiting
│   ├── core/
│   │   ├── config.py            # Pydantic-settings · .env driven
│   │   ├── database.py          # SQLAlchemy async · SQLite ORM
│   │   ├── pipeline.py          # CUDA-thread orchestrator · FFmpeg transcoding
│   │   └── schemas.py           # Pydantic request/response models
│   ├── sea_raft/                # SEA-RAFT source (git clone)
│   │   └── core/
│   │       ├── raft.py          # RAFT model architecture
│   │       ├── update.py        # GRU update block
│   │       ├── extractor.py     # ResNet feature extractor
│   │       └── corr.py          # Correlation volume
│   ├── main.py                  # FastAPI app · REST + WebSocket routes
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── pages/
        │   ├── Dashboard.jsx    # Live stats · charts · GPU monitor
        │   ├── Upload.jsx       # Drag-drop · real-time progress feed
        │   ├── Sessions.jsx     # Session management
        │   ├── VideoPlayer.jsx  # Video playback · incident timeline · AI summary
        │   └── Incidents.jsx    # Filterable incident table
        ├── components/
        │   ├── UI.jsx           # Design system (Panel, Badge, Button, etc.)
        │   ├── Sidebar.jsx      # Navigation
        │   └── IncidentCard.jsx # Incident display with frame thumbnail
        └── hooks/
            └── useWebSocket.js  # Real-time WebSocket hook
```

---

## Installation

### Prerequisites

- Python 3.10+
- Node.js 20+
- NVIDIA GPU with CUDA 12.x *(required for SEA-RAFT and YOLOv8 acceleration)*
- FFmpeg (`sudo apt install ffmpeg`)

### 1. Clone SEA-RAFT

```bash
git clone --depth=1 https://github.com/princeton-vl/SEA-RAFT.git backend/sea_raft
```

### 2. Download SEA-RAFT Weights

Download `Tartan-C-T-TSKH-spring540x960-M.pth` from the [SEA-RAFT Google Drive](https://drive.google.com/drive/folders/1YLovlvUW94vciWvTyLf-p3uWscbOQRWW):

```bash
mkdir -p backend/sea_raft/models
mv ~/Downloads/Tartan-C-T-TSKH-spring540x960-M.pth backend/sea_raft/models/
```

### 3. Backend Setup

```bash
cd backend

# Install PyTorch with CUDA 12.1 first
pip install torch==2.3.0+cu121 torchvision==0.18.0+cu121 \
    --index-url https://download.pytorch.org/whl/cu121

# Install remaining dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Set GEMINI_API_KEY in .env
# Get one free at: https://aistudio.google.com/app/apikey

# Start server
PYTHONPATH=$PWD python main.py
# → API:    http://localhost:8000
# → Docs:   http://localhost:8000/docs
```

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
# → UI: http://localhost:5173
```

---

## API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload video file, begin async analysis |
| `GET` | `/api/sessions` | List all analysis sessions |
| `GET` | `/api/sessions/{id}` | Session status and metadata |
| `GET` | `/api/sessions/{id}/video-info` | Video URL + incident timeline + AI summary |
| `DELETE` | `/api/sessions/{id}` | Remove session and all associated data |
| `GET` | `/api/incidents` | List incidents (filterable by `session_id`, `severity`) |
| `GET` | `/api/incidents/{id}` | Single incident with full description |
| `GET` | `/api/video/{session_id}` | Stream H.264 video with Range request support |
| `GET` | `/api/gpu-info` | GPU status, VRAM usage, model info |
| `GET` | `/health` | Health check |

### WebSocket

```
WS /ws/{session_id}
```

All messages are JSON with a `type` field:

```jsonc
// Processing progress
{ "type": "progress", "data": { "processed": 45, "total": 456, "incidents": 3, "progress_pct": 9.8 }}

// Real-time incident alert
{ "type": "incident", "data": { "event_type": "overcrowding", "severity": "medium", "timestamp": "00:01:23", "confidence": 0.72, "description": "..." }}

// Analysis complete
{ "type": "done", "data": { "session_id": "...", "incidents": 12 }}

// Pipeline error
{ "type": "error", "data": { "session_id": "...", "message": "..." }}
```

---

## Configuration

All settings in `backend/.env`:

```bash
# ── Core ──────────────────────────────────────────────
GEMINI_API_KEY=your_key_here     # https://aistudio.google.com/app/apikey

# ── GPU / Model ───────────────────────────────────────
YOLO_MODEL=yolov8m.pt            # n / s / m / l / x  (n=fastest, x=best)
CUDA_DEVICE=0                    # GPU index

# ── Pipeline ──────────────────────────────────────────
FRAME_SKIP=3                     # Process every Nth frame (3 = ~10fps at 30fps input)
CONFIDENCE_THRESHOLD=0.5         # YOLOv8 detection confidence floor

# ── Storage ───────────────────────────────────────────
UPLOAD_DIR=uploads
OUTPUT_DIR=outputs
DATABASE_URL=sqlite+aiosqlite:///./surveillance.db

# ── Email Alerts (optional) ───────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
ALERT_EMAIL=security@yourorg.com
```

---

## Supported Video Formats

| Format | Container | Browser Playback |
|--------|-----------|-----------------|
| H.264 | `.mp4` | ✅ Native |
| H.265/HEVC | `.mp4` | ✅ Auto-transcoded |
| MPEG-4 / FMP4 | `.avi` | ✅ Auto-transcoded |
| DivX / Xvid | `.avi` | ✅ Auto-transcoded |
| ProRes | `.mov` | ✅ Auto-transcoded |
| Any codec | `.mkv` | ✅ Auto-transcoded |

All non-native formats are automatically transcoded to H.264 MP4 via FFmpeg on upload. AI analysis always runs on the **original full-quality file**.

---

## Detected Anomaly Types

| Event | Severity | Trigger Condition |
|-------|----------|-------------------|
| `crowd_panic` | 🔴 Critical | ≥4 persons + motion >3σ above baseline + sudden spike |
| `fight_or_aggression` | 🟠 High | sudden_motion=True + max_magnitude >3σ + ≥2 persons |
| `overcrowding` | 🟡 Medium | ≥10 persons for 5 consecutive analysed frames |
| `crowd_gathering` | 🟡 Medium | 4–9 persons + motion <0.3σ above baseline for 5 frames |
| `suspicious_loitering` | 🟢 Low | 1 person + motion <80% of baseline for 40 frames |

All thresholds are **relative to each video's learned baseline** — the same rules work on 320×240 CCTV footage and 1080p surveillance cameras without any manual tuning.

---

## Performance Benchmarks

Measured on **NVIDIA RTX 4050 Laptop (6GB VRAM)**:

| Video Resolution | FPS (Pipeline) | SEA-RAFT ms/frame | YOLOv8m ms/frame |
|-----------------|----------------|-------------------|------------------|
| 320×240 | ~55 | ~12ms | ~8ms |
| 640×480 | ~45 | ~18ms | ~10ms |
| 1280×720 | ~28 | ~28ms | ~12ms |
| 1920×1080 | ~18 | ~42ms | ~15ms |

*Pipeline FPS accounts for `FRAME_SKIP=3` — actual video processed at 1/3 of input FPS.*

---

## Incident Report Example

When an anomaly is confirmed, Gemini 1.5 Flash generates a report like:

> *At timestamp 00:01:47, a group of 14 individuals was detected with motion magnitude significantly exceeding the established baseline (52.5 vs baseline 2.3), with all subjects moving rapidly in the same direction toward the east exit. The sustained nature of this movement over 5 consecutive frames, combined with the high person density, is consistent with a crowd panic or emergency evacuation scenario. Immediate security response is recommended.*

---

## Roadmap

- [ ] **RTSP live stream support** — process IP camera feeds directly
- [ ] **Weapon detection** — custom YOLOv8 model trained on weapons dataset (Roboflow)
- [ ] **Facial recognition** — DeepFace integration for person re-identification
- [ ] **Crowd density heatmap** — spatial density visualisation overlay on video
- [ ] **LSTM anomaly prediction** — predict incidents before they escalate
- [ ] **Multi-camera grid** — simultaneous monitoring of N camera feeds
- [ ] **PostgreSQL backend** — production-grade database for large deployments
- [ ] **PDF report export** — downloadable incident reports per session
- [ ] **Docker Compose** — one-command deployment with GPU passthrough

---

## Acknowledgements

- [SEA-RAFT](https://github.com/princeton-vl/SEA-RAFT) — Yihan Wang, Lahav Lipson, Jia Deng (Princeton, ECCV 2024)
- [Ultralytics YOLOv8](https://github.com/ultralytics/ultralytics) — Real-time object detection
- [Google Gemini](https://ai.google.dev/) — Natural-language incident reporting
- [FastAPI](https://fastapi.tiangolo.com/) — Async Python web framework

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">
  <sub>Built with Python · FastAPI · React · YOLOv8 · SEA-RAFT · Gemini</sub>
</div>

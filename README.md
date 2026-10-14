<div align="center">

# AVSA: Autonomous Video Surveillance Agents
### Edge-to-Cloud Multi-Agent AI Framework for Behavioral Anomaly Detection & Forensic Reporting

<p align="center">
  <strong>A production-grade, multi-agent AI surveillance system combining real-time object tracking, deep optical flow, adaptive statistical baselining, and multimodal foundation models.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10%20%7C%203.11%20%7C%203.12-3776AB?style=flat-square&logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/PyTorch-2.x%20%2B%20CUDA-EE4C2C?style=flat-square&logo=pytorch&logoColor=white"/>
  <img src="https://img.shields.io/badge/FastAPI-0.111-009688?style=flat-square&logo=fastapi&logoColor=white"/>
  <img src="https://img.shields.io/badge/React-18%20%2B%20Vite-61DAFB?style=flat-square&logo=react&logoColor=black"/>
  <img src="https://img.shields.io/badge/YOLOv8m-FP16%20TensorRT-FF6600?style=flat-square"/>
  <img src="https://img.shields.io/badge/SEA--RAFT-ECCV%202024-00e5ff?style=flat-square"/>
  <img src="https://img.shields.io/badge/Google%20Gemini-Flash%20Multimodal-4285F4?style=flat-square&logo=google&logoColor=white"/>
  <img src="https://img.shields.io/badge/IEEE%20Format-Manuscript%20Included-00629B?style=flat-square"/>
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square"/>
</p>

[System Architecture](#system-architecture) • [Key Capabilities](#key-capabilities) • [Quick Start](#quick-start) • [UI/UX & Themes](#uiux--themes) • [API Reference](#api-reference) • [IEEE Manuscript & Evaluation](#ieee-manuscript--benchmarks)

</div>

---

## Overview

**AVSA (Autonomous Video Surveillance Agents)** is an end-to-end, multi-agent artificial intelligence platform designed for municipal, enterprise, and campus security environments. Unlike monolithic black-box neural networks, AVSA decomposes the video analytics pipeline into **six decoupled, collaborative micro-agents**:

1. **Vision Agent**: GPU-accelerated spatial perception via **YOLOv8m** with FP16 inference, outputting real-time bounding boxes (**Green for routine activity**, **Red for confirmed threats**).
2. **Motion Agent**: Dense flow tracking using Princeton's **SEA-RAFT** (ECCV 2024), computing 75th-percentile non-zero motion velocity and directional dispersion.
3. **Behavior Agent**: Dynamically learns an per-video statistical baseline ($\mu, \sigma$) during initial calibration and applies independent **sustained counters** to prevent transient false alarms.
4. **Reasoning Agent**: Multi-criteria weighted threat evaluation with temporal deduplication gating to suppress redundant notifications.
5. **Report Agent**: Synthesizes structured forensic telemetry into legally defensible, human-readable natural language narratives via **Google Gemini Flash**.
6. **Alert Agent**: Dispatches sub-second WebSocket state pushes, interactive dashboard telemetry, and optional SMTP security dispatches.

---

## Key Capabilities

### 1. Dual Bounding Box Protocol (Normal vs. Abnormal)
* **🟢 Green Bounding Box (`[NORMAL] <Class> <Conf>%`)**: Identifies routine pedestrian walking pace, standard density, and stationary vehicles.
* **🔴 Red Bounding Box (`[ABNORMAL ALERT] <Event> <Conf>%`)**: Triggered when multi-agent reasoning confirms an incident (e.g., panic scattering, physical aggression, overcrowding, or suspicious loitering), complete with top-left tactical HUD banners.
* **Dual-Stream Playback**: Viewers can toggle live on the frontend between:
  - `🎯 YOLO Detection Boxes`: Watch video playback with live bounding boxes rendered frame-by-frame.
  - `📹 Raw Feed`: Inspect pristine original camera feed.

### 2. Intuitive Optical Flow Velocity Speedometer
To eliminate confusion for non-technical security personnel, deep optical flow tensor fields are translated into an actionable 3-zone activity speedometer:
* **Zone 1: Calm Motion (< 4.0 px/frame)** — Normal walking pace; bounding boxes remain green.
* **Zone 2: Active Gathering (4.0 – 8.0 px/frame)** — Clustering, rapid walking, or heightened activity.
* **Zone 3: Sudden Surge (> 8.0 px/frame)** — High velocity running, emergency scattering, or physical altercations; triggers red anomaly bounding boxes.
* **Interactive Guide**: Accessible via the header "Bounding Box & Motion Guide" button for onboarding operators.

### 3. Redesigned Unified 3-Column Surveillance Station
* **Left Column (Surveillance Player)**: Full H.264 streaming player with dual-stream selector, scrub timeline with severity-coded anomaly pips, and real-time optical flow gauge.
* **Center Column (Forensic Box Inspector)**: Displays the active anomaly's high-contrast red bounding box snapshot, threat classification, and Gemini forensic explanation. Includes an **Expand ↗** high-res modal.
* **Right Column (Timeline Feed)**: Filterable chronological anomalies with live red-box thumbnail badges and one-click video seek.

### 4. World-Class Dark & Light Themes
* **Obsidian Dark Mode**: Deep midnight slate (`#0b0f19`) and rich cards (`#131b2e`) with hairline borders (`#1f2a42`), soft sky blue accents (`#38bdf8`), and zero distracting scanlines or jitter animations.
* **Pristine Light Mode**: Clean Apple/Stripe-inspired pearl slate (`#f8fafc`) with pure white elevated surfaces (`#ffffff`).
* **Theme Persistence**: Toggled via the sidebar sun/moon button and persisted in `localStorage`.

---

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          VIDEO INGESTION LAYER                         │
│    File Upload (MP4/AVI/MOV/MKV/WebM) ──► FFmpeg H.264 Dual Transcode  │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Frame extraction (FRAME_SKIP=3)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     PARALLEL GPU INFERENCE LAYER                       │
│                                                                        │
│   ┌───────────────────────────┐      ┌──────────────────────────────┐  │
│   │       Vision Agent        │      │         Motion Agent         │  │
│   │    YOLOv8m · CUDA FP16    │      │    SEA-RAFT · CUDA FP32      │  │
│   │                           │      │                              │  │
│   │  • Object localization    │      │  • Dense velocity vectors    │  │
│   │  • Class confidence       │      │  • Non-zero p75 magnitude    │  │
│   │  • Green/Red bounding box │      │  • Directional divergence    │  │
│   └─────────────┬─────────────┘      └──────────────┬───────────────┘  │
└─────────────────┼───────────────────────────────────┼──────────────────┘
                  └─────────────────┬─────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       BEHAVIOR REASONING LAYER                         │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                        Behavior Agent                          │   │
│   │  • Adaptive baseline learning (initial 20 frames: μ, σ)        │   │
│   │  • Dynamic multi-anomaly rule evaluation                       │   │
│   │  • Sustained frame counter (K=5 frames debouncing)             │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                        Reasoning Agent                         │   │
│   │  • Weighted multi-factor confidence scoring                    │   │
│   │  • Temporal deduplication window                               │   │
│   │  • should_report gating decision                               │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
└───────────────────────────────────┼────────────────────────────────────┘
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       REPORTING & DISPATCH LAYER                       │
│                                                                        │
│   ┌───────────────────────────────┐  ┌─────────────────────────────┐   │
│   │         Report Agent          │  │         Alert Agent         │   │
│   │      Google Gemini Flash      │  │  WebSocket broadcast (sub-s)│   │
│   │  Auditable incident narrative │  │  SMTP Email notifications   │   │
│   └───────────────┬───────────────┘  └──────────────┬──────────────┘   │
└───────────────────┼─────────────────────────────────┼──────────────────┘
                    ▼                                 ▼
          ┌───────────────────────────────────────────────────┐
          │            Async SQLite / PostgreSQL DB           │
          │     Incidents · Annotated Frames · Sessions       │
          └───────────────────────────────────────────────────┘
```

---

## Tech Stack

### Deep Learning & Backend
* **Python 3.10 – 3.12** with native async/await
* **FastAPI 0.111** + **Uvicorn**: High-concurrency async REST and WebSocket endpoints
* **Ultralytics YOLOv8m**: Spatial object detection running in Tensor Core FP16
* **SEA-RAFT (ECCV 2024 Oral)**: State-of-the-art optical flow with dynamic module registration
* **Google Gemini 1.5 / 2.5 Flash**: Multimodal forensic narrative synthesis
* **FFmpeg**: Hardware-accelerated browser transcoding with faststart `moov` atom placement
* **SQLAlchemy + aiosqlite**: Asynchronous ORM persistence

### Frontend Dashboard
* **React 18** + **Vite 5**: Optimized single-page application
* **Tailwind CSS**: Custom HSL-tailored dark and light design system
* **Recharts**: Responsive threat distributions and category bar metrics
* **React Router v6**: Modular client-side routing

---

## Quick Start

### 1. Prerequisites
* **Operating System**: Linux (Ubuntu 20.04/22.04/24.04 recommended) or Windows with WSL2
* **NVIDIA GPU**: RTX 2060 or higher with 6GB+ VRAM (tested on RTX 4050 Laptop GPU)
* **System Packages**: `git`, `ffmpeg`, `curl`, `python3-venv`, `nodejs` (v18+)

### 2. Automated One-Command Setup
Run the automated environment preparation script:
```bash
chmod +x setup_gpu.sh
./setup_gpu.sh
```
This script automatically:
* Verifies NVIDIA driver and CUDA availability.
* Sets up the virtual environment (`backend/venv`).
* Installs PyTorch with CUDA 12 support.
* Clones SEA-RAFT and downloads pre-trained model weights.
* Installs backend and frontend dependencies.

### 3. Manual Installation

#### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate

# 1. Install PyTorch with CUDA 12.1
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# 2. Install dependencies
pip install -r requirements.txt

# 3. Clone SEA-RAFT (if not already present)
git clone --depth=1 https://github.com/princeton-vl/SEA-RAFT.git sea_raft

# 4. Download SEA-RAFT Tartan weights into ~/.cache/sea_raft/ and sea_raft/models/
mkdir -p ~/.cache/sea_raft sea_raft/models
# Download Tartan-C-T-TSKH-spring540x960-M.pth from Princeton SEA-RAFT release

# 5. Configure environment variables
cp .env.example .env
# Edit .env and insert your free GEMINI_API_KEY from Google AI Studio:
# GEMINI_API_KEY="AIzaSy..."

# 6. Launch Backend Server
PYTHONPATH=$PWD python main.py
```
* Backend API: `http://localhost:8000`
* Swagger Interactive Docs: `http://localhost:8000/docs`

#### Frontend
```bash
cd frontend
npm install
npm run dev
```
* Web Dashboard: `http://localhost:5173`

---

## UI/UX & Themes

| Feature | Dark Mode | Light Mode |
|---|---|---|
| **Base Surface** | `#0b0f19` (Obsidian Midnight) | `#f8fafc` (Clean Pearl Slate) |
| **Panel Surface** | `#131b2e` (Rich Slate Card) | `#ffffff` (Elevated Pure White) |
| **Border Tone** | `#1f2a42` (Hairline Slate) | `#e2e8f0` (Subtle Edge) |
| **Normal Status** | `#22c55e` (Emerald Green) | `#16a34a` (Forest Green) |
| **Alert Status** | `#ef4444` (Surveillance Crimson) | `#dc2626` (Pure Red) |
| **Typography** | Plus Jakarta Sans + JetBrains Mono | Plus Jakarta Sans + JetBrains Mono |

---

## API Reference

### Core Endpoints

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/upload` | Ingest video file, initiate async transcoding and multi-agent pipeline |
| `GET` | `/api/sessions` | Retrieve all past surveillance sessions with processing state |
| `GET` | `/api/sessions/{id}` | Status, frame counts, and metadata for a specific session |
| `GET` | `/api/sessions/{id}/video-info` | Video streaming URL, annotated stream availability, timeline, and forensic summary |
| `DELETE` | `/api/sessions/{id}` | Purge session, uploaded files, and database records |
| `GET` | `/api/incidents` | Query detected behavioral anomalies (filterable by `session_id`, `severity`) |
| `GET` | `/api/incidents/{id}` | Inspect single incident forensics and frame path |
| `GET` | `/api/video/{session_id}` | HTML5 Range-request video stream (`?annotated=true` for live YOLO boxes) |
| `GET` | `/api/gpu-info` | Telemetry endpoint reporting CUDA device name, VRAM, and model precisions |
| `GET` | `/health` | Liveness healthcheck |

### WebSocket Real-Time Stream

Connect to `/ws/{session_id}` for live event streaming:
```jsonc
// Real-time analysis progress
{ "type": "progress", "data": { "processed": 120, "total": 450, "incidents": 2, "progress_pct": 26.7 } }

// Confirmed threat alert
{ 
  "type": "incident", 
  "data": { 
    "event_type": "crowd_panic", 
    "severity": "critical", 
    "timestamp": "00:00:53", 
    "confidence": 0.84, 
    "description": "Rapid outward dispersion detected exceeding 3σ baseline velocity." 
  } 
}
```

---

## Detected Anomaly Classifications

| Anomaly Class | Severity | Quantitative Trigger Condition |
|---|---|---|
| `crowd_panic` | 🔴 **Critical** | $\ge 4$ persons + motion magnitude $> \mu + 3\sigma$ + sudden acceleration spike |
| `fight_or_aggression` | 🟠 **High** | Sudden velocity spike + peak magnitude $> \mu + 3\sigma$ + $\ge 2$ interacting persons |
| `overcrowding` | 🟡 **Medium** | $\ge 10$ persons sustained for $K=5$ consecutive analyzed frames |
| `crowd_gathering` | 🟡 **Medium** | $4 \le \text{persons} \le 9$ with low velocity ($\le \mu + 0.3\sigma$) sustained for $K=5$ frames |
| `suspicious_loitering` | 🟢 **Low** | Single stationary subject ($< 0.8\mu$ motion) sustained over 40 frames |

---

### Reproducible Benchmarking Suite
To evaluate pipeline throughput, latency, and ablation metrics:
```bash
cd backend
source venv/bin/activate
python benchmark_evaluation.py
```
This generates comparative performance tables (YOLOv8m FP16 vs SEA-RAFT vs Farneback baseline) and sustains counter ablation matrices.

---

## Project Structure

```
autonomous-video-surveillance-agents/
├── backend/
│   ├── agents/
│   │   ├── vision_agent.py        # YOLOv8m (FP16) · Green/Red surveillance bounding boxes
│   │   ├── motion_agent.py        # SEA-RAFT (ECCV 2024) · Non-zero p75 flow velocity
│   │   ├── behavior_agent.py      # Adaptive baseline (μ, σ) · Sustained counters (K=5)
│   │   ├── reasoning_agent.py     # Multi-criteria scoring · Deduplication gating
│   │   ├── report_agent.py        # Gemini Flash · Natural language forensic reports
│   │   └── alert_agent.py         # Sub-second WebSocket dispatch & rate-limited SMTP
│   ├── core/
│   │   ├── config.py              # Pydantic Settings · .env management
│   │   ├── database.py            # Async SQLAlchemy + SQLite ORM
│   │   ├── pipeline.py            # Multi-agent orchestrator & companion annotated video encoder
│   │   └── schemas.py             # Pydantic DTO models
│   ├── sea_raft/                  # Cloned SEA-RAFT architecture & model weights
│   ├── benchmark_evaluation.py    # IEEE benchmark evaluation suite
│   ├── main.py                    # FastAPI server & streaming endpoints
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── context/
│   │   │   └── ThemeContext.jsx   # Dark / Light theme provider with persistence
│   │   ├── components/
│   │   │   ├── IncidentCard.jsx   # Anomaly card with red-box thumbnail badge
│   │   │   ├── MotionActivityGauge.jsx # 3-Zone optical flow speedometer
│   │   │   ├── MotionGuideModal.jsx    # Plain-English guide for colors & velocity
│   │   │   ├── Sidebar.jsx        # Navigation & theme toggle
│   │   │   └── UI.jsx             # Reusable design system tokens
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx      # Telemetry overview & threat distribution charts
│   │   │   ├── Incidents.jsx      # Filterable incident alert log
│   │   │   ├── Sessions.jsx       # Video session management
│   │   │   ├── Upload.jsx         # Video upload & real-time inference tracker
│   │   │   └── VideoPlayer.jsx    # 3-column unified surveillance dashboard
│   │   ├── utils/
│   │   │   └── api.js             # API client & robust frame URL resolver
│   │   └── index.css              # Custom HSL design tokens (Obsidian Dark / Pearl Light)
│   └── vite.config.js
├── paper/
│   ├── paper.tex                  # Formal two-column IEEE LaTeX manuscript
│   ├── references.bib             # BibTeX citations (YOLOv8, SEA-RAFT, UCF-Crime, etc.)
│   └── IEEE_SUBMISSION_GUIDE.md   # Step-by-step submission & compilation walkthrough
├── setup_gpu.sh                   # Automated Linux/CUDA environment installation script
└── README.md
```

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

<div align="center">
  <sub>AVSA: Autonomous Video Surveillance Agents • Built with PyTorch · Ultralytics · SEA-RAFT · Gemini · FastAPI · React</sub>
</div>

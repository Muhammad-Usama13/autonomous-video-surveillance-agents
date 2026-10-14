#!/usr/bin/env bash
# =============================================================================
# AVSA GPU Setup Script — Ubuntu + CUDA 12.x + RTX 30xx/40xx
# Uses SEA-RAFT (ECCV 2024 Best Paper Candidate) for optical flow.
# Run once from the project root directory.
# =============================================================================

set -e
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'

echo -e "${CYAN}"
echo "  ╔══════════════════════════════════════════════════════════════╗"
echo "  ║   AVSA — GPU Setup  (SEA-RAFT + YOLOv8 + CUDA 12)          ║"
echo "  ╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── 0. NVIDIA driver ─────────────────────────────────────────────────────────
echo -e "${YELLOW}[1/8] Checking NVIDIA driver...${NC}"
if ! command -v nvidia-smi &> /dev/null; then
    echo -e "${RED}ERROR: nvidia-smi not found. Install drivers:${NC}"
    echo "  sudo apt install nvidia-driver-545 && sudo reboot"
    exit 1
fi
nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
echo -e "${GREEN}✓ NVIDIA driver OK${NC}"

# ── 1. CUDA ───────────────────────────────────────────────────────────────────
echo -e "${YELLOW}[2/8] Checking CUDA...${NC}"
for cuda_candidate in /usr/local/cuda /usr/local/cuda-12* /usr/local/cuda-11*; do
    if [ -d "$cuda_candidate/bin" ]; then
        export PATH="$cuda_candidate/bin:$PATH"
        export LD_LIBRARY_PATH="$cuda_candidate/lib64:${LD_LIBRARY_PATH:-}"
        break
    fi
done

if ! command -v nvcc &> /dev/null; then
    echo -e "${RED}nvcc not found. Install CUDA 12:${NC}"
    echo "  wget https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.1-1_all.deb"
    echo "  sudo dpkg -i cuda-keyring_1.1-1_all.deb"
    echo "  sudo apt update && sudo apt install cuda-12-4"
    exit 1
fi
nvcc --version | head -1
echo -e "${GREEN}✓ CUDA OK${NC}"

# ── 2. Clone SEA-RAFT ─────────────────────────────────────────────────────────
echo -e "${YELLOW}[3/8] Checking SEA-RAFT source in backend/sea_raft/...${NC}"
if [ ! -d "backend/sea_raft/core" ]; then
    rm -rf backend/sea_raft
    git clone --depth=1 https://github.com/princeton-vl/SEA-RAFT.git backend/sea_raft
    echo -e "${GREEN}✓ SEA-RAFT cloned${NC}"
else
    echo -e "${GREEN}✓ SEA-RAFT already present (skipping)${NC}"
fi

# ── 3. Python virtualenv ──────────────────────────────────────────────────────
echo -e "${YELLOW}[4/8] Creating Python virtualenv...${NC}"
cd backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip wheel setuptools -q
echo -e "${GREEN}✓ venv ready${NC}"

# ── 4. PyTorch CUDA 12.1 ─────────────────────────────────────────────────────
echo -e "${YELLOW}[5/8] Installing PyTorch 2.3 + CUDA 12.1 (~2.5 GB)...${NC}"
pip install torch==2.3.0+cu121 torchvision==0.18.0+cu121 torchaudio==2.3.0+cu121 \
    --index-url https://download.pytorch.org/whl/cu121 -q
echo -e "${GREEN}✓ PyTorch CUDA installed${NC}"

# ── 5. Verify GPU ─────────────────────────────────────────────────────────────
echo -e "${YELLOW}[6/8] Verifying GPU in PyTorch...${NC}"
python3 -c "
import torch
assert torch.cuda.is_available(), 'CUDA not visible!'
p = torch.cuda.get_device_properties(0)
print(f'  GPU : {p.name}')
print(f'  VRAM: {p.total_memory/1e9:.1f} GB')
print(f'  CUDA: {torch.version.cuda}')
print(f'  FP16 Tensor Cores: supported on RTX')
"
echo -e "${GREEN}✓ GPU verified${NC}"

# ── 6. Project requirements ───────────────────────────────────────────────────
echo -e "${YELLOW}[7/8] Installing project requirements (SEA-RAFT deps included)...${NC}"
pip install -r requirements.txt -q
echo -e "${GREEN}✓ All packages installed${NC}"

# ── 7. Pre-download weights ───────────────────────────────────────────────────
echo -e "${YELLOW}[8/8] Pre-downloading model weights...${NC}"
python3 -c "
import sys
sys.path.insert(0, 'sea_raft')

print('  [1/2] YOLOv8m...')
from ultralytics import YOLO
YOLO('yolov8m.pt')
print('  YOLOv8m ready')

print('  [2/2] SEA-RAFT-M from HuggingFace (~100 MB)...')
from huggingface_hub import hf_hub_download
from pathlib import Path
path = hf_hub_download(
    repo_id='MemorySlices/Tartan-C-T-TSKH-spring540x960-M',
    filename='model.pth',
    cache_dir=str(Path.home() / '.cache' / 'sea_raft'),
)
print(f'  SEA-RAFT-M cached at: {path}')
"
echo -e "${GREEN}✓ All weights downloaded${NC}"

# ── Done ──────────────────────────────────────────────────────────────────────
cd ..
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗"
echo "║   Setup Complete!  Stack ready:                              ║"
echo "║    YOLOv8m   — object detection  (FP16, CUDA)               ║"
echo "║    SEA-RAFT  — optical flow      (FP16, CUDA, ECCV 2024)    ║"
echo "║    Gemini    — incident reports  (LLM)                      ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║   cd backend                                                 ║"
echo "║   cp .env.example .env   # add GEMINI_API_KEY               ║"
echo "║   source venv/bin/activate && python main.py                 ║"
echo "║                                                              ║"
echo "║   cd frontend && npm install && npm run dev                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

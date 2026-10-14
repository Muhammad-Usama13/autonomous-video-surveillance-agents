# IEEE Research Preparation & Submission Guide
**Project**: AVSA: Autonomous Multi-Agent Video Surveillance System

---

## 1. Target IEEE Venues & Tracks

| Venue | Full Title | Impact / Type | Best Fit Rationale |
|---|---|---|---|
| **IEEE AVSS** | *IEEE International Conference on Advanced Video and Signal Based Surveillance* | Top Surveillance Conference | Direct focus on CCTV, multi-camera tracking, real-time anomaly detection. |
| **IEEE ICIP** | *IEEE International Conference on Image Processing* | Leading Signal/Vision Conference | Great fit for SEA-RAFT optical flow + deep vision multi-agent pipeline. |
| **IEEE TCSVT** | *IEEE Transactions on Circuits and Systems for Video Technology* | Q1 Journal (IF ~8.4) | Ideal for comprehensive system paper with hardware/throughput benchmarks. |
| **IEEE T-ITS** | *IEEE Transactions on Intelligent Transportation Systems* | Q1 Journal (IF ~8.5) | Ideal if emphasizing traffic, vehicle, pedestrian crowd dynamics. |
| **IEEE Access** | *IEEE Access (Computer Vision Track)* | Open Access Q1 Journal | Fast review cycle (~4-6 weeks), ideal for end-to-end applied architectures. |

---

## 2. Key Novelty & Research Contributions for Reviewers

When publishing in IEEE, reviewers look for **clear scientific contributions** beyond basic software engineering:

1. **Decoupled Asynchronous Multi-Agent Framework**:
   * *Problem*: Monolithic end-to-end models (e.g., 3D CNNs, VideoMAE) suffer from lack of interpretability, high computational complexity, and all-or-nothing failures.
   * *Contribution*: Decoupling inference into modular agents (Vision, Motion, Behavior, Reasoning, Report, Alert) running on asynchronous pipelines enables sub-second real-time responsiveness and modular upgrades.

2. **Adaptive Baseline Optical Flow Calibration**:
   * *Problem*: Hardcoded flow thresholds fail across camera angles, resolutions (320p vs 1080p), and codecs.
   * *Contribution*: Formulates dynamic baseline learning $(\mu_{\text{baseline}}, \sigma_{\text{baseline}})$ calculated over the 75th percentile ($p_{75}$) of non-zero flow vectors. This mathematically normalizes motion sensitivity across heterogeneous camera feeds without manual tuning.

3. **Sustained Counter Hysteresis vs. Cooldown Starvation**:
   * *Problem*: Traditional voting buffers with cooldown periods starve consecutive detections or cause catastrophic false alarm cascades on frame noise.
   * *Contribution*: State-machine sustained counter confirmation requiring $K$ consecutive positive observations before firing with natural debouncing.

4. **Explainable Foundation Model Incident Reporting**:
   * *Problem*: Standard anomaly systems output raw bounding boxes or binary alert signals without contextual semantics.
   * *Contribution*: Structured prompt synthesis fed into Gemini 1.5/2.5 Flash produces human-readable, auditable, and legally defensible forensic incident narratives.

---

## 3. How to Compile the IEEE LaTeX Paper

1. Ensure a TeX distribution is installed (e.g. `texlive-full` or `pdflatex`):
   ```bash
   sudo apt install texlive-latex-extra texlive-fonts-recommended texlive-bibtex-extra
   ```
2. Navigate to the `paper/` directory:
   ```bash
   cd paper
   pdflatex paper.tex
   bibtex paper
   pdflatex paper.tex
   pdflatex paper.tex
   ```
3. Open `paper.pdf` to inspect the two-column IEEE format manuscript.

---

## 4. Empirical Evaluation Protocol

To strengthen your submission, report the following tables produced by `benchmark_evaluation.py`:
- **Table I**: Computational Latency & Throughput breakdown per agent (YOLOv8m FP16 vs SEA-RAFT FP32 vs Farneback).
- **Table II**: Ablation on Sustained Counter Threshold ($K \in \{1, 3, 5, 8\}$) demonstrating precision improvements.
- **Table III**: Frame-level AUC on standard benchmarks (UCF-Crime / ShanghaiTech Campus).

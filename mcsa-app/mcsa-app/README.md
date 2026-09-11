# MotorSense — Motor Current Signature Analysis (MCSA) Web App

A professional, industry-grade web application for fault detection in three-phase
induction motors via Motor Current Signature Analysis.

## What It Does

Analyzes the motor stator current in the **frequency domain** to detect mechanical
faults (worn bearings, cracked rotor bars, misalignment, phase loss) **without
requiring additional vibration sensors**.

### Full DSP Pipeline (all stages visible in the UI)
1. **Bandpass Filter** — Butterworth, SOS form (numerically stable at 50 kHz)
2. **FFT Spectrum** — Hann-windowed to suppress leakage near sidebands
3. **Welch PSD** — Averaged, lower-variance spectral estimate
4. **Hilbert Envelope Spectrum** — Isolates AM modulation from mechanical faults
5. **Slip/Sideband Calculation** — f_sb = f ± 2·k·f_slip
6. **Feature Extraction** — Sideband levels in dB relative to fundamental
7. **Health Verdict** — Rule-based: HEALTHY / FAULT LIKELY

### Two Main Views
- **Single File Pipeline Walkthrough** — All 7 stages displayed in order
- **Healthy vs. Faulty Comparison** — Overlay charts + ? dB table

## Dataset

Motor Fault Detection Data — 0.2 kW three-phase squirrel-cage induction motor,
vibration + voltage + current synchronously sampled at 50 kHz.

**Paper:** "Comprehensive Fault Diagnosis of Three-Phase Induction Motors Using
Synchronized Multi-Sensor Data Collection," *Scientific Data* (2025)  
<https://www.nature.com/articles/s41597-025-05437-3>

**Dataset:** <https://doi.org/10.6084/m9.figshare.27216219>

**File columns:** `x, y, Z` (vibration) · `I1, I2, I3` (stator current) · `V1, V2, V3` (voltage)

## Quick Start — Docker (Recommended)

**Prerequisites:** Docker Desktop (Windows/Mac) or Docker + Docker Compose (Linux)

```bash
git clone <repo-url>
cd mcsa-app
docker compose up --build
```

Open **http://localhost:3000** in your browser.

> The backend API is available at **http://localhost:8000**.  
> Interactive API docs: **http://localhost:8000/docs**

## Quick Start — Local Development

### Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**

## Usage

1. **Configure motor parameters** in the left sidebar:
   - Sampling rate (default: 50 000 Hz)
   - Supply frequency (50 Hz / 60 Hz)
   - Motor rated RPM and pole count
   - Bandpass filter cutoffs
   - Fault threshold (default: -40 dB)

2. **Upload a file** (`.csv` or `.mat`, up to ~200 MB):
   - The file will be parsed and columns detected automatically
   - Select the current channel to analyze: **I1**, **I2**, or **I3**

3. **Run Full MCSA Pipeline** — all 7 stages appear in sequence

4. Optionally switch to the **Healthy vs. Faulty Comparison** tab,
   upload two recordings, and see overlay spectra + ? dB table

## Architecture

```
mcsa-app/
+-- backend/               # Python + FastAPI
¦   +-- main.py            # REST API endpoints
¦   +-- dsp_pipeline.py    # All DSP: filter, FFT, Welch, Hilbert, features
¦   +-- file_parser.py     # CSV + MAT (legacy + HDF5) readers
¦   +-- requirements.txt
¦   +-- Dockerfile
+-- frontend/              # React + Vite
¦   +-- src/
¦   ¦   +-- App.jsx
¦   ¦   +-- components/
¦   ¦       +-- ParameterPanel.jsx
¦   ¦       +-- FileUpload.jsx
¦   ¦       +-- PipelineView.jsx   # 7-stage walkthrough
¦   ¦       +-- ComparisonView.jsx # Overlay + ? table
¦   ¦       +-- SpectrumChart.jsx  # Reusable Plotly chart
¦   ¦       +-- VerdictBadge.jsx
¦   ¦       +-- FeatureTable.jsx
¦   +-- Dockerfile
¦   +-- nginx.conf
+-- docker-compose.yml
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Liveness check |
| POST | `/api/parse` | Upload file ? return columns + metadata |
| POST | `/api/analyze` | Full pipeline on one file |
| POST | `/api/compare` | Pipeline on two files (comparison) |

## Technical Notes

- **Filter stability:** The Butterworth filter uses SOS (second-order sections)
  form, not the raw (b,a) transfer function, which is numerically unstable for
  narrow passbands relative to a 50 kHz sampling rate.
- **Spectral leakage:** A Hann window is applied before every FFT. Fault
  sidebands sit only a few Hz from the 50 Hz fundamental, so leakage
  suppression is critical.
- **Large file handling:** Files are streamed to a temporary path; only one
  channel array is held in memory at a time. Charts display a 100 ms window
  for time-domain views; full signal is used for all spectral computations.
- **Data quality checks:** Automatic detection of trend-log data (not raw
  waveform) and wrong supply frequency entry.

## License

MIT License — free to use, modify, and distribute.

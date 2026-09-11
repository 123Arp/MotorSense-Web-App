# MotorSense — DSP-Based Motor Current Signature Analysis (MCSA)

**MotorSense** is an industrial-grade diagnostic web application for the predictive maintenance and fault detection of three-phase squirrel-cage induction motors using **Motor Current Signature Analysis (MCSA)**.

By analyzing the stator current in the frequency domain, MotorSense detects and quantifies mechanical and electrical anomalies (rotor-bar defects, air-gap eccentricity, mechanical misalignment, bearing deterioration, and phase imbalance) **without requiring dedicated vibration sensors**.

---

## Academic & Data Source Citation

Developed as a signal processing engineering diagnostic system based on the dataset:

> **Paper:** "Comprehensive Fault Diagnosis of Three-Phase Induction Motors Using Synchronized Multi-Sensor Data Collection", *Scientific Data* (2025).  
> **DOI:** [https://www.nature.com/articles/s41597-025-05437-3](https://www.nature.com/articles/s41597-025-05437-3)  
> **Dataset:** [https://doi.org/10.6084/m9.figshare.27216219](https://doi.org/10.6084/m9.figshare.27216219)

**Data Specification:**
- Motor: 0.2 kW three-phase squirrel-cage induction motor
- Synchronized channels (9 total):
  - Vibration accelerometer: `x`, `y`, `Z`
  - Stator current: `I1`, `I2`, `I3`
  - Supply voltage: `V1`, `V2`, `V3`
- Sampling Frequency: **50 kHz**
- Formats supported: `.csv` and MATLAB `.mat` (v5/v7 legacy and v7.3+ HDF5)

---

## Complete DSP Pipeline Architecture

All signal processing algorithms are built from first principles using standard mathematical libraries (NumPy and SciPy):

1. **Automatic Data Quality Checks:**
   - *Trend-log detection:* Flags stuck sensors or low-speed RMS logs where long runs of identical samples (>20 consecutive values across >50% of the recording) would invalidate frequency-domain analysis.
   - *Fundamental-dominance check:* Verifies that the configured supply frequency (e.g. 50 Hz or 60 Hz) corresponds to the dominant carrier peak (>=30% of global spectrum max).
2. **Bandpass Filtering (Butterworth SOS):**
   - Implemented in **Second-Order Sections (SOS)** form rather than direct `(b, a)` transfer functions to maintain numerical stability for narrow passbands at 50 kHz. Zero-phase bidirectional filtering (`sosfiltfilt`).
3. **FFT Amplitude Spectrum (Hann Window):**
   - Applies a Hann window with coherent power gain compensation to suppress spectral leakage sidelobes (~-31 dB), resolving fault sidebands situated only a few Hertz from the carrier.
4. **Welch Power Spectral Density (PSD):**
   - Averaged periodogram over overlapping segments to reduce spectral variance.
5. **Hilbert Envelope Demodulation:**
   - Computes the analytic signal $z(t) = x(t) + j\mathcal{H}\{x(t)\}$, extracts the instantaneous amplitude envelope $a(t) = |z(t)|$, removes DC bias, and computes its spectrum to isolate fault-induced amplitude modulation (AM).
6. **Motor Kinematics & Sideband Tracking:**
   - Synchronous Speed: $N_s = \frac{120 \cdot f_{supply}}{P}$
   - Motor Slip: $s = \frac{N_s - N_r}{N_s}$
   - Slip Frequency: $f_{slip} = s \cdot f_{supply}$
   - Sideband Frequencies ($k=1$): $f_{sb} = f_{supply} \pm 2 k f_{slip}$
7. **Feature Extraction:**
   - Measures peak amplitudes near sideband frequencies and normalizes them in decibels relative to the fundamental carrier:
     $$L_{\text{dB}} = 20 \log_{10}\left(\frac{A_{\text{sideband}}}{A_{\text{fundamental}}}\right)$$
8. **Automated Diagnostic Health Verdict:**
   - Evaluates the worst-case sideband level against a configurable threshold (default: $-40\text{ dB}$).
   - Flags **HEALTHY** or **FAULT LIKELY** with complete engineering justification.

---

## Project Structure

```
MotorSense-Web-App/
├── backend/                  # FastAPI DSP Service
│   ├── dsp_pipeline.py       # First-principles DSP pipeline
│   ├── file_parser.py        # CSV, MATLAB v5/v7 & v7.3 HDF5 readers
│   ├── main.py               # REST API endpoints & sample streamer
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                 # React 18 + Vite + Tailwind CSS
│   ├── public/
│   │   ├── favicon.svg
│   │   └── _redirects        # Netlify proxy configuration
│   ├── src/
│   │   ├── components/
│   │   │   ├── ParameterPanel.jsx
│   │   │   ├── FileUpload.jsx
│   │   │   ├── PipelineView.jsx
│   │   │   ├── ComparisonView.jsx
│   │   │   ├── SpectrumChart.jsx
│   │   │   ├── FeatureTable.jsx
│   │   │   └── VerdictBadge.jsx
│   │   ├── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── data_test/                # Sample 50 kHz multi-channel recordings
│   ├── FILE 1.mat
│   └── FILE 6.mat
├── docker-compose.yml
├── netlify.toml
├── render.yaml
└── README.md
```

---

## Deployment Options

### Option 1: Docker Compose (Local or Production VM)
```bash
git clone https://github.com/123Arp/MotorSense-Web-App.git
cd MotorSense-Web-App
docker compose up --build
```
- **Web Interface:** `http://localhost:3000`
- **FastAPI Documentation:** `http://localhost:8000/docs`

### Option 2: Render.com Deployment (Free Cloud Hosting)
1. In Render, select **New +** → **Blueprint** and connect this repository (reads `render.yaml`).
2. Alternatively, create a **Web Service**:
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Deploy frontend as a **Static Site**:
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`

### Option 3: Netlify Deployment
- Connect the repository to Netlify. The included `netlify.toml` automatically builds from `frontend` and proxies `/api/*` to the live backend.
- Or drag-and-drop the pre-built `dist/` folder directly to [Netlify Drop](https://app.netlify.com/drop).
- In the web app header, click **Backend Offline/Online** to configure the backend API URL at any time.

---

## Local Development (Without Docker)

### Backend:
```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend:
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:3000` in your browser.

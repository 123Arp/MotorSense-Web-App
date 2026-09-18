# DSP-Based Motor Current Signature Analysis (MCSA)
## Predictive Maintenance Tool for Three-Phase Induction Motors

A **fully browser-based** DSP analysis tool. Upload your motor current recording and get instant spectral analysis — **no backend, no server, no data upload**.

---

## Quick Start

1. **Download / clone** this repository
2. **Serve** `index.html` from a local web server:
   ```bash
   # Python (recommended — needed for Web Worker CORS policy)
   python -m http.server 8080
   # Then open http://localhost:8080
   ```
3. Or deploy directly to **GitHub Pages** (push to `main` branch, enable Pages in Settings)

> **⚠ Important:** You must serve via HTTP, not open `file://` directly.  
> Web Workers are blocked by the browser's same-origin policy when loading via `file://`.

---

## Features

| Feature | Details |
|---|---|
| **Input formats** | CSV (with/without header), MATLAB .mat (v5 / v7.3 HDF5) |
| **Max file size** | ~200 MB (limited by browser RAM) |
| **Processing** | Fully local — motor data never leaves your computer |
| **FFT** | Radix-2 Cooley-Tukey with Hann window, up to 2M points |
| **Welch PSD** | Configurable segment length and overlap |
| **Hilbert envelope** | Amplitude demodulation via analytic signal |
| **Butterworth filter** | SOS implementation, configurable order and cutoffs |
| **Sideband analysis** | Automatic lower/upper sideband detection in dB |
| **Health verdict** | Rule-based HEALTHY / FAULT LIKELY assessment |
| **Comparison mode** | Overlay healthy vs faulty spectra, ΔdB table |
| **Export** | JSON report download |

---

## Supported Data Format

### CSV Files

```
x,y,Z,I1,I2,I3,V1,V2,V3
0.00000000,0.00000000,0.00000000,1.234,1.235,1.230,220.1,220.2,220.0
...
```

- **With header row:** Columns `I1`, `I2`, `I3` are automatically detected.
- **Without header row:** Columns are mapped positionally: `x(0), y(1), Z(2), I1(3), I2(4), I3(5)`.
- Large files are parsed in 4 MB streaming chunks.

### MATLAB .mat Files

- **Level-5 (v5):** Pure JavaScript binary reader — no dependencies.
- **v7.3 (HDF5):** Requires h5wasm (bundled in `libs/`).
- Variable names containing `I1`, `I2`, or `I3` are auto-detected; all variables are listed for manual selection.

---

## Motor Parameters

| Parameter | Default | Notes |
|---|---|---|
| Sampling frequency | 50,000 Hz | Must match your recording |
| Supply frequency | 50 Hz | 60 Hz for US/Japan |
| Rated RPM | 1440 | From nameplate |
| Number of poles | 4 | From nameplate |
| Bandpass low cutoff | 1 Hz | Keep below fundamental |
| Bandpass high cutoff | 5,000 Hz | Keep below Nyquist |
| Fault threshold | −40 dB | Adjust per motor type |

---

## DSP Methods

### 1. FFT Spectrum
Windowed DFT of the filtered current signal. Provides precise frequency identification.  
Window: Hann. Sideband marker lines at f ± 2·f_slip.

### 2. Welch PSD
Averaged PSD via overlapping windowed segments. Reduces spectral variance for noisy/short signals.

### 3. Hilbert Envelope Spectrum
Amplitude demodulation via the analytic signal. Reveals fault modulation frequencies without the carrier (supply frequency) component.

---

## Sideband Calculation

```
Synchronous speed:  Ns  = 120 · f / P
Slip:               s   = (Ns − Nr) / Ns
Slip frequency:     f_s = s · f
Lower sideband:     f_L = f − 2·f_s
Upper sideband:     f_U = f + 2·f_s
```

**Relative sideband level:**
```
L_dB = 20 · log10(A_sideband / A_fundamental)
```

**Health rule:**
```
worst_sideband_dB > threshold → FAULT LIKELY
worst_sideband_dB ≤ threshold → HEALTHY
```

Default threshold: −40 dB. Values commonly cited in literature range from −30 to −55 dB depending on motor size, load, and installation.

---

## Reference Data

This tool was designed for use with:

> **Motor Fault Detection Data — 0.2 kW three-phase squirrel-cage induction motor**  
> Synchronously sampled at 50 kHz (vibration, voltage, current)  
> 10 CSV files covering healthy and faulty (phase removal, mechanical misalignment) conditions

**Paper:** [Comprehensive Fault Diagnosis of Three-Phase Induction Motors Using Synchronized Multi-Sensor Data Collection](https://www.nature.com/articles/s41597-025-05437-3), *Scientific Data* (2025)  
**Dataset:** [doi:10.6084/m9.figshare.27216219](https://doi.org/10.6084/m9.figshare.27216219)

---

## File Structure

```
mcsa/
├── index.html              ← Application entry point
├── style.css               ← Engineering UI styles
├── app.js                  ← Main thread: UI controller + Plotly charts
├── dsp-worker.js           ← Web Worker: ALL DSP computation
├── fft.js                  ← Radix-2 Cooley-Tukey FFT (used by worker)
├── butterworth.js          ← Butterworth SOS bandpass filter design
├── csv-parser-worker.js    ← Chunked streaming CSV parser
├── mat-parser-worker.js    ← MATLAB .mat parser (v5 + v7.3 HDF5)
├── libs/
│   ├── plotly-basic.min.js ← Plotly.js basic bundle (bundled locally)
│   └── hdf5_hl.js          ← h5wasm HDF5 library (for MATLAB v7.3 files)
└── README.md
```

---

## Privacy

- All file processing occurs **entirely in the browser** using the Web Workers API.
- Motor current data **never leaves your computer**.
- No analytics, no telemetry, no cookies.
- Suitable for use with sensitive industrial data.

---

## Limitations

- **Rule-based assessment only:** The HEALTHY / FAULT LIKELY verdict is a simplified engineering heuristic. It is NOT a guaranteed fault diagnosis and should be interpreted by a qualified engineer.
- **Single-frequency sideband analysis:** Only the primary pair (f ± 2·f_slip) is analysed. Higher-order sidebands are not currently detected.
- **MATLAB v7.3 compressed:** Files saved with compression may require conversion to v5: `save('file.mat', '-v5', 'I1')`.
- **File size:** Browser memory sets the practical limit (~200 MB for a 9-column, 50 kHz CSV at ~4 bytes/sample).

---

## License

MIT License — free to use, modify, and distribute.

---

*Built with: Radix-2 FFT · Butterworth SOS · Welch PSD · Hilbert transform · Plotly.js*

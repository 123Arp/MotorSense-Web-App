# MotorSense Project Reports & Academic Documentation

This directory contains the academic progress reports and final project documentation for the **DSP-Based Motor Current Signature Analysis (MCSA) for Predictive Maintenance of Induction Motors** project, completed for the BS in Electronic Systems program at the **Indian Institute of Technology Madras (IIT Madras)**.

---

## Documents

| Document | File | Date | Description |
|---|---|---|---|
| **Final Project Report** | [MotorSense_Final_Project_Report.pdf](./MotorSense_Final_Project_Report.pdf) | 18-09-2026 | Full 25-page comprehensive final report covering theoretical foundation, DSP architecture, algorithm implementation, problem solving, dual-method validation (FFT & Welch PSD), Hilbert envelope analysis, and threshold sensitivity analysis. |
| **Mid-Term Progress Report** | [MotorSense_Mid_Term_Progress_Report.pdf](./MotorSense_Mid_Term_Progress_Report.pdf) | 30-08-2026 | 9-page mid-term report detailing dataset evaluation, first-principles DSP pipeline implementation, mathematical formulation, initial synthetic/real validation, and project timeline. |

---

## Project Metadata

- **Author:** Arpit Katiyar
- **Roll Number:** 24f1100064 (ES24F1100064)
- **Institution:** Indian Institute of Technology Madras (IIT Madras)
- **Degree Program:** BS in Electronic Systems
- **Course / Track:** Signal Processing Project
- **Instructor / Course POD:** Vishal
- **Project Code:** Custom (own topic proposal, approved with 5% bonus)
- **Live Netlify Deployment:** [https://arpitmotorsense.netlify.app/](https://arpitmotorsense.netlify.app/)
- **Video Demonstration:** [Google Drive Link](https://drive.google.com/file/d/14phbgEznthW56Czj5QAwZIYJ9sOutjIW/view?usp=sharing)
- **Source Code Archive:** [Google Drive Link](https://drive.google.com/file/d/1vdpsHEyG1BcHx3m-hzZHuSaRrhdH0IQg/view?usp=sharing)

---

## Executive Summary of the Reports

### 1. Final Project Report (`MotorSense_Final_Project_Report.pdf`)
- **Abstract & Methodology:** End-to-end signal processing pipeline taking raw stator current recordings (CSV or MAT up to ~200 MB parsed completely client-side), applying 4th-order SOS Butterworth bandpass filtering, Hann-windowed FFT, Welch averaged periodogram PSD, and Hilbert-transform envelope demodulation.
- **Key Breakthroughs & Safeguards:**
  - Automatic oversampling / duplicate-sample detector (resolved real 5x oversampled 50 kHz -> 10 kHz acquisition mismatch).
  - Fundamental-dominance check (prevents false fault detection when wrong supply frequency, e.g. 60 Hz vs 50 Hz, is configured).
  - Second-Order Section (SOS) bandpass filter stabilization (preventing overflow of standard direct-form Butterworth filters on high-rate narrowband signals).
- **Validation Results:**
  - **Synthetic signals:** Correctly separated healthy motor (~ -80 dB sideband) from faulty motor (~ -27 dB sideband).
  - **Real 1,000,000-sample industrial dataset (0.2 kW motor, 161.4 MB):** FFT method (-52.91/-50.49 dB) and Welch PSD (-46.45/-43.68 dB) independently agreed on a **HEALTHY** verdict.
  - **Corroborating Hilbert envelope:** Detected modulation peak at 2.441 Hz close to theoretical $2 \times f_{\text{slip}} = 3.333\text{ Hz}$ at low amplitude ($1.361 \times 10^{-3}$), confirming lack of severe fault modulation.
  - **Threshold sensitivity:** Stable HEALTHY verdict from -30 dB down to -50 dB.

### 2. Mid-Term Progress Report (`MotorSense_Mid_Term_Progress_Report.pdf`)
- **Dataset Discovery:** Documented the rejection of MAFAULDA (which lacks current sensors) and slow trend-log datasets, adopting the Figshare 50 kHz multi-sensor induction motor dataset.
- **Core DSP Implementation:** Implementation of first-principles radix-2 FFT, zero-phase SOS filtering, Welch PSD, and Hilbert envelope detection in browser-side Web Workers.
- **Milestones & Deliverables:** Successful deployment of initial single-file and comparison dashboards, initial synthetic verification, and planned roadmap.

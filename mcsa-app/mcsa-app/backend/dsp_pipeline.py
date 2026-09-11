"""
DSP Pipeline for Motor Current Signature Analysis (MCSA)
=========================================================
All functions implemented from first principles using NumPy/SciPy.
No black-box fault-detection library calls — every stage is explicit.

Pipeline stages:
  1. Data quality checks (trend-log detector + fundamental dominance)
  2. Bandpass filter (Butterworth, SOS form — numerically stable)
  3. FFT spectrum (Hann-windowed, amplitude corrected)
  4. Welch PSD (averaged, lower-variance spectral estimate)
  5. Hilbert envelope spectrum (amplitude-modulation analysis)
  6. Slip / sideband frequency calculation
  7. Feature extraction (sideband dB levels relative to fundamental)
  8. Rule-based health verdict
"""

import numpy as np
from scipy import signal as sp_signal
from typing import Dict, Any, Tuple, Optional, List
import logging

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# DATA QUALITY CHECKS
# ─────────────────────────────────────────────────────────────────────────────

def data_quality_check(sig: np.ndarray) -> Dict[str, Any]:
    """
    Check 1 — Trend-log / stuck-sensor detector.
    Long runs of identical consecutive values indicate an RMS/trend log
    rather than a raw high-speed waveform.  If >50% of the signal lies
    inside runs of 20+ identical samples → ERROR-level warning.
    """
    warnings: List[Dict] = []
    n = len(sig)
    if n < 2:
        return {"warnings": warnings, "passed": True}

    diffs = np.diff(sig)
    is_zero = np.isclose(diffs, 0.0, atol=1e-15)

    total_in_long = 0
    max_run = 0
    run_len = 0
    for z in is_zero:
        if z:
            run_len += 1
        else:
            if run_len > 0:
                actual = run_len + 1
                if actual > 20:
                    total_in_long += actual
                if actual > max_run:
                    max_run = actual
            run_len = 0
    if run_len > 0:
        actual = run_len + 1
        if actual > 20:
            total_in_long += actual
        if actual > max_run:
            max_run = actual

    fraction = total_in_long / max(n, 1)
    if max_run > 20 and fraction > 0.50:
        warnings.append({
            "type": "trend_log_detected",
            "severity": "ERROR",
            "message": (
                f"Signal looks like a trend/RMS log, not a raw waveform. "
                f"Longest run of identical values: {max_run} samples; "
                f"{fraction*100:.1f}% of signal affected. "
                "MCSA on this data will produce meaningless results."
            ),
        })

    return {"warnings": warnings, "passed": len(warnings) == 0}


def fundamental_dominance_check(
    freqs: np.ndarray,
    magnitude: np.ndarray,
    f_supply: float,
    search_window_hz: float = 3.0,
) -> Dict[str, Any]:
    """
    Verify amplitude at f_supply is a dominant peak (>=30% of global max).
    If not, the supply-frequency setting is likely wrong for this recording.
    """
    global_max = float(np.max(magnitude)) if len(magnitude) > 0 else 0.0
    if global_max < 1e-20:
        return {"ratio": 0.0, "warnings": [], "passed": True}

    mask = np.abs(freqs - f_supply) <= search_window_hz
    local_max = float(np.max(magnitude[mask])) if np.any(mask) else 0.0
    ratio = local_max / (global_max + 1e-20)

    warnings: List[Dict] = []
    if ratio < 0.30:
        dominant_freq = float(freqs[np.argmax(magnitude)])
        warnings.append({
            "type": "fundamental_not_dominant",
            "severity": "WARNING",
            "message": (
                f"Supply frequency peak at {f_supply:.1f} Hz is only "
                f"{ratio*100:.1f}% of the spectrum maximum "
                f"(dominant peak: {dominant_freq:.2f} Hz). "
                "Check that the supply frequency setting matches this recording."
            ),
        })

    return {"ratio": ratio, "warnings": warnings, "passed": ratio >= 0.30}


# ─────────────────────────────────────────────────────────────────────────────
# STAGE 2 — BANDPASS FILTER
# ─────────────────────────────────────────────────────────────────────────────

def bandpass_filter(
    sig: np.ndarray,
    fs: float,
    low_cut: float,
    high_cut: float,
    order: int = 4,
) -> np.ndarray:
    """
    Butterworth bandpass filter in SOS (second-order sections) form.
    SOS is numerically stable for narrow passbands at high sampling rates —
    the direct (b,a) form overflows for these conditions.
    sosfiltfilt applies zero-phase filtering (forward + backward pass).
    """
    nyq = fs / 2.0
    low = np.clip(low_cut / nyq, 1e-6, 0.9999)
    high = np.clip(high_cut / nyq, low + 1e-6, 0.9999)
    sos = sp_signal.butter(order, [low, high], btype="bandpass", output="sos")
    return sp_signal.sosfiltfilt(sos, sig)


# ─────────────────────────────────────────────────────────────────────────────
# STAGE 3 — FFT SPECTRUM
# ─────────────────────────────────────────────────────────────────────────────

def compute_fft(sig: np.ndarray, fs: float) -> Tuple[np.ndarray, np.ndarray]:
    """
    One-sided amplitude spectrum with Hann window.
    Hann window suppresses spectral leakage (~-31 dB first sidelobe)
    so fault sidebands a few Hz from the 50 Hz fundamental are visible.
    Amplitude is corrected for the window's coherent gain.
    """
    N = len(sig)
    window = np.hanning(N)
    cg = np.sum(window) / N          # coherent gain (~0.5 for Hann)
    fft_vals = np.fft.rfft(sig * window)
    magnitude = (np.abs(fft_vals) * 2.0) / (N * cg)
    freqs = np.fft.rfftfreq(N, d=1.0 / fs)
    return freqs, magnitude


# ─────────────────────────────────────────────────────────────────────────────
# STAGE 4 — WELCH PSD
# ─────────────────────────────────────────────────────────────────────────────

def compute_welch_psd(
    sig: np.ndarray,
    fs: float,
    nperseg: Optional[int] = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Welch's PSD: averaged periodogram over overlapping Hann-windowed segments.
    Lower variance than a single FFT — better for detecting low-level sidebands.
    """
    N = len(sig)
    if nperseg is None:
        nperseg = min(65536, max(256, N // 4))
    freqs, psd = sp_signal.welch(
        sig, fs=fs, window="hann",
        nperseg=nperseg, noverlap=nperseg // 2,
        scaling="density", detrend="constant",
    )
    return freqs, psd


# ─────────────────────────────────────────────────────────────────────────────
# STAGE 5 — HILBERT ENVELOPE SPECTRUM
# ─────────────────────────────────────────────────────────────────────────────

def compute_hilbert_envelope_spectrum(
    filtered_sig: np.ndarray,
    fs: float,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Hilbert-transform envelope analysis:
      z(t)  = filtered(t) + j·H{filtered(t)}   (analytic signal)
      a(t)  = |z(t)|                            (instantaneous amplitude)
      FFT( a(t) )                               (envelope spectrum)
    Reveals amplitude modulation by mechanical faults at slip-frequency
    multiples, independent of the 50 Hz carrier.
    """
    analytic = sp_signal.hilbert(filtered_sig)
    envelope = np.abs(analytic)
    envelope -= np.mean(envelope)   # remove DC to suppress 0 Hz spike
    return compute_fft(envelope, fs)


# ─────────────────────────────────────────────────────────────────────────────
# STAGE 6 — SLIP / SIDEBAND FREQUENCIES
# ─────────────────────────────────────────────────────────────────────────────

def calculate_slip_sidebands(
    f_supply: float,
    rated_rpm: float,
    poles: int,
) -> Dict[str, float]:
    """
    Ns        = 120 * f / P          (synchronous speed, RPM)
    s         = (Ns - Nr) / Ns      (slip, dimensionless)
    f_slip    = s * f               (slip frequency, Hz)
    f_sb      = f ± 2*k*f_slip      (sideband frequencies, k=1)
    """
    Ns = 120.0 * f_supply / max(poles, 1)
    s  = (Ns - float(rated_rpm)) / max(Ns, 1e-6)
    f_slip = abs(s) * f_supply
    return {
        "Ns_rpm": round(Ns, 2),
        "Nr_rpm": round(float(rated_rpm), 2),
        "slip": round(s, 6),
        "slip_pct": round(s * 100, 4),
        "f_slip_hz": round(f_slip, 4),
        "f_supply_hz": round(f_supply, 2),
        "f_sb_lower_hz": round(f_supply - 2.0 * f_slip, 4),
        "f_sb_upper_hz": round(f_supply + 2.0 * f_slip, 4),
    }


# ─────────────────────────────────────────────────────────────────────────────
# STAGE 7 — FEATURE EXTRACTION
# ─────────────────────────────────────────────────────────────────────────────

def extract_sideband_features(
    freqs: np.ndarray,
    magnitude: np.ndarray,
    f_supply: float,
    f_sb_lower: float,
    f_sb_upper: float,
    search_window_hz: float = 2.0,
) -> Dict[str, Any]:
    """
    L_dB = 20 * log10(A_sideband / A_fundamental)
    Searches ±search_window_hz around each nominal frequency for the peak.
    """
    def find_peak(f_target: float) -> Tuple[float, float]:
        mask = np.abs(freqs - f_target) <= search_window_hz
        if not np.any(mask):
            idx = int(np.argmin(np.abs(freqs - f_target)))
        else:
            sub = int(np.argmax(magnitude[mask]))
            idx = int(np.where(mask)[0][sub])
        return float(freqs[idx]), float(magnitude[idx])

    eps = 1e-15
    f_f, A_f = find_peak(f_supply)
    f_l, A_l = find_peak(f_sb_lower)
    f_u, A_u = find_peak(f_sb_upper)

    A_f_safe = max(A_f, eps)
    L_l = 20.0 * np.log10(max(A_l, eps) / A_f_safe)
    L_u = 20.0 * np.log10(max(A_u, eps) / A_f_safe)

    return {
        "f_fundamental_hz": f_f,
        "A_fundamental": A_f,
        "f_lower_sb_hz": f_l,
        "A_lower_sb": A_l,
        "L_lower_dB": round(L_l, 2),
        "f_upper_sb_hz": f_u,
        "A_upper_sb": A_u,
        "L_upper_dB": round(L_u, 2),
        "worst_sideband_dB": round(max(L_l, L_u), 2),
    }


# ─────────────────────────────────────────────────────────────────────────────
# STAGE 8 — HEALTH VERDICT
# ─────────────────────────────────────────────────────────────────────────────

def make_verdict(worst_dB: float, threshold_dB: float) -> Dict[str, str]:
    if worst_dB > threshold_dB:
        return {
            "verdict": "FAULT_LIKELY",
            "label": "FAULT LIKELY",
            "color": "red",
            "explanation": (
                f"Worst sideband: {worst_dB:.1f} dB (threshold: {threshold_dB:.1f} dB). "
                "Significant sideband energy detected — consistent with rotor-bar fault, "
                "misalignment, or phase asymmetry."
            ),
        }
    return {
        "verdict": "HEALTHY",
        "label": "HEALTHY",
        "color": "green",
        "explanation": (
            f"Worst sideband: {worst_dB:.1f} dB (threshold: {threshold_dB:.1f} dB). "
            "No significant fault sidebands detected."
        ),
    }


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def downsample_for_chart(
    x: np.ndarray,
    y: np.ndarray,
    max_points: int = 5000,
) -> Tuple[List[float], List[float]]:
    """Peak-preserving downsampler: takes the peak-magnitude sample per bucket."""
    N = len(x)
    if N <= max_points:
        return x.tolist(), y.tolist()
    bucket = N // max_points
    n_b = N // bucket
    x_o, y_o = np.empty(n_b), np.empty(n_b)
    for i in range(n_b):
        s, e = i * bucket, (i + 1) * bucket
        pk = int(np.argmax(np.abs(y[s:e])))
        x_o[i] = x[s + pk]
        y_o[i] = y[s + pk]
    return x_o.tolist(), y_o.tolist()


# ─────────────────────────────────────────────────────────────────────────────
# FULL PIPELINE RUNNER
# ─────────────────────────────────────────────────────────────────────────────

def run_full_pipeline(sig: np.ndarray, fs: float, params: Dict[str, Any]) -> Dict[str, Any]:
    """Run the complete MCSA pipeline. Returns all stage results for the UI."""
    f_supply   = float(params.get("f_supply",    50.0))
    rated_rpm  = float(params.get("rated_rpm", 1450.0))
    poles      = int(params.get("poles",          4))
    low_cut    = float(params.get("low_cut",     1.0))
    high_cut   = float(params.get("high_cut",  200.0))
    filt_order = int(params.get("filter_order",   4))
    thr_dB     = float(params.get("threshold_dB", -40.0))

    N = len(sig)
    results: Dict[str, Any] = {}
    all_warnings: List[Dict] = []

    # Stage 1: Raw signal
    qc = data_quality_check(sig)
    all_warnings.extend(qc["warnings"])
    disp_n = min(int(0.1 * fs), N)
    t_disp = (np.arange(disp_n) / fs).tolist()
    results["raw_signal"] = {
        "t": t_disp,
        "x": sig[:disp_n].tolist(),
        "total_samples": N,
        "duration_s": round(N / fs, 4),
        "fs_hz": fs,
        "display_window_ms": round(disp_n / fs * 1000, 1),
    }

    # Stage 2: Bandpass filter
    filtered = bandpass_filter(sig, fs, low_cut, high_cut, filt_order)
    results["filtered_signal"] = {
        "t": t_disp,
        "raw": sig[:disp_n].tolist(),
        "filtered": filtered[:disp_n].tolist(),
        "low_cut_hz": low_cut,
        "high_cut_hz": high_cut,
        "order": filt_order,
    }

    # Stage 3: FFT
    fft_freqs, fft_mag = compute_fft(filtered, fs)
    fft_xf, fft_yf = downsample_for_chart(fft_freqs, fft_mag, 5000)
    zoom_lo, zoom_hi = max(0.0, f_supply - 50.0), f_supply + 50.0
    zm = (fft_freqs >= zoom_lo) & (fft_freqs <= zoom_hi)
    fft_xz, fft_yz = fft_freqs[zm].tolist(), fft_mag[zm].tolist()

    fd = fundamental_dominance_check(fft_freqs, fft_mag, f_supply)
    all_warnings.extend(fd["warnings"])

    results["fft"] = {
        "freqs_full": fft_xf, "mag_full": fft_yf,
        "freqs_zoom": fft_xz, "mag_zoom": fft_yz,
        "freq_resolution_hz": round(fs / N, 6),
    }

    # Stage 4: Welch PSD
    wf, wpsd = compute_welch_psd(filtered, fs)
    psd_dB = 10.0 * np.log10(wpsd + 1e-30)
    wxf, wyf = downsample_for_chart(wf, psd_dB, 5000)
    wm = (wf >= zoom_lo) & (wf <= zoom_hi)
    wxz, wyz = wf[wm].tolist(), psd_dB[wm].tolist()
    results["welch_psd"] = {
        "freqs_full": wxf, "psd_db_full": wyf,
        "freqs_zoom": wxz, "psd_db_zoom": wyz,
    }

    # Stage 5: Hilbert envelope
    ef, em_arr = compute_hilbert_envelope_spectrum(filtered, fs)
    env_max = f_supply * 3.0
    emask = ef <= env_max
    exz, eyz = ef[emask].tolist(), em_arr[emask].tolist()
    exf, eyf = downsample_for_chart(ef, em_arr, 5000)
    results["hilbert_envelope"] = {
        "freqs_full": exf, "mag_full": eyf,
        "freqs_zoom": exz, "mag_zoom": eyz,
    }

    # Stage 6: Slip/sidebands
    sb = calculate_slip_sidebands(f_supply, rated_rpm, poles)
    results["sideband_info"] = sb

    # Stage 7: Features
    features = extract_sideband_features(
        fft_freqs, fft_mag, f_supply,
        sb["f_sb_lower_hz"], sb["f_sb_upper_hz"]
    )
    results["features"] = features

    # Stage 8: Verdict
    results["verdict"] = make_verdict(features["worst_sideband_dB"], thr_dB)
    results["threshold_dB"] = thr_dB
    results["quality_check"] = {"warnings": all_warnings, "passed": len(all_warnings) == 0}

    return results

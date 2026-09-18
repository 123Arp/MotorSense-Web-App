'use strict';
/**
 * butterworth.js — Butterworth Bandpass Filter (SOS Implementation)
 *
 * Designs a Butterworth bandpass filter using Second-Order Sections (SOS).
 * SOS avoids the numerical instability of direct-form (b,a) transfer functions,
 * which become severely ill-conditioned at high sampling rates (e.g. 50 kHz).
 *
 * Algorithm overview:
 *  1. Generate analog Butterworth LP prototype poles (unit circle, left half-plane).
 *  2. Pre-warp band-edge frequencies for the bilinear transform.
 *  3. Apply the LP→BP pole transformation (each LP pole → 2 BP poles).
 *  4. Apply the bilinear transform (s-plane → z-plane).
 *  5. Group complex-conjugate pole pairs into biquad (SOS) sections.
 *  6. Assign bandpass zeros (N at z=+1, N at z=−1) → numerator b=[g,0,−g].
 *  7. Normalize each section's gain to unity at the passband centre.
 *
 * Reference:
 *   Oppenheim & Schafer, "Discrete-Time Signal Processing", 3rd ed., Ch. 7.
 */

// ─── Complex Arithmetic ───────────────────────────────────────────────────────

const cAdd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
const cSub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
const cMul = (a, b) => ({ re: a.re*b.re - a.im*b.im, im: a.re*b.im + a.im*b.re });
const cDiv = (a, b) => {
    const d = b.re*b.re + b.im*b.im;
    if (d < 1e-300) return { re: 0, im: 0 };
    return { re: (a.re*b.re + a.im*b.im) / d, im: (a.im*b.re - a.re*b.im) / d };
};
const cAbs = (z) => Math.sqrt(z.re*z.re + z.im*z.im);
const cSqrt = (z) => {
    const r     = Math.sqrt(cAbs(z));
    const theta = Math.atan2(z.im, z.re) / 2;
    return { re: r * Math.cos(theta), im: r * Math.sin(theta) };
};

// ─── Polynomial Evaluation at a Complex Point ─────────────────────────────────

/**
 * Evaluate a polynomial in z^{-1} at a complex point zc.
 * H(z) = coeffs[0] + coeffs[1]·z^{-1} + coeffs[2]·z^{-2} + ...
 *
 * @param {number[]} coeffs - Polynomial coefficients in z^{-1}
 * @param {{re,im}} zc      - Complex evaluation point
 * @returns {{re,im}} Complex result
 */
function evalPolyZInv(coeffs, zc) {
    // Compute z^{-1}
    const zcInv = cDiv({ re: 1, im: 0 }, zc);
    let acc  = { re: 0, im: 0 };
    let zPow = { re: 1, im: 0 }; // z^{-k}, starts at 1 (k=0)
    for (let k = 0; k < coeffs.length; k++) {
        acc = cAdd(acc, { re: coeffs[k] * zPow.re, im: coeffs[k] * zPow.im });
        zPow = cMul(zPow, zcInv);
    }
    return acc;
}

// ─── Filter Design ────────────────────────────────────────────────────────────

/**
 * Design a Butterworth bandpass filter as Second-Order Sections.
 *
 * @param {number} order   - LP prototype order (total BP order = 2·order)
 *                           Recommended: 2 (4th-order bandpass, 2 biquad sections)
 * @param {number} lowHz   - Low  band-edge frequency in Hz (must be > 0)
 * @param {number} highHz  - High band-edge frequency in Hz (must be < Fs/2)
 * @param {number} fs      - Sampling frequency in Hz
 *
 * @returns {Array<{b:number[], a:number[]}>}
 *          SOS array; each section: { b:[b0,b1,b2], a:[1,a1,a2] }
 *
 * @throws {Error} on invalid parameters
 */
function designButterworthSOS(order, lowHz, highHz, fs) {
    // ── Validate inputs ────────────────────────────────────────────────────
    const nyquist = fs / 2;
    if (!Number.isFinite(lowHz) || !Number.isFinite(highHz) || !Number.isFinite(fs)) {
        throw new Error('Filter frequencies must be finite numbers.');
    }
    if (lowHz <= 0) {
        throw new Error(`Low cutoff must be > 0 Hz (got ${lowHz} Hz).`);
    }
    if (highHz >= nyquist) {
        throw new Error(
            `High cutoff (${highHz} Hz) must be below the Nyquist frequency (${nyquist} Hz).`
        );
    }
    if (lowHz >= highHz) {
        throw new Error(
            `Low cutoff (${lowHz} Hz) must be less than high cutoff (${highHz} Hz).`
        );
    }
    if (order < 1 || order > 8 || !Number.isInteger(order)) {
        throw new Error('Filter order must be an integer between 1 and 8.');
    }

    // ── 1. Pre-warp band-edge frequencies ─────────────────────────────────
    //    ωa = 2·Fs·tan(π·f/Fs)
    //    This ensures exact frequency response at lowHz and highHz after
    //    the bilinear transform.
    const wL = 2 * fs * Math.tan(Math.PI * lowHz  / fs);
    const wH = 2 * fs * Math.tan(Math.PI * highHz / fs);
    const Bw = wH - wL;                // Analog bandwidth
    const w0 = Math.sqrt(wL * wH);    // Geometric center frequency

    // ── 2. Analog Butterworth LP prototype poles ───────────────────────────
    //    Poles lie on the unit circle in the left half-plane:
    //      p_k = exp( j·π·(2k + N − 1) / (2N) ),  k = 1 … N
    //    All have Re(p_k) < 0 (stable).
    const lpPoles = [];
    for (let k = 1; k <= order; k++) {
        const angle = Math.PI * (2 * k + order - 1) / (2 * order);
        lpPoles.push({ re: Math.cos(angle), im: Math.sin(angle) });
    }

    // ── 3. LP → BP pole transformation ────────────────────────────────────
    //    Substitution: s_LP ← (s² + ω₀²) / (Bw · s)
    //    Solving for s gives, for each LP pole p_k:
    //      s = (p_k · Bw/2) ± √[ (p_k · Bw/2)² − ω₀² ]
    //    Each LP pole produces 2 BP poles.
    const bpPoles = [];
    for (const p of lpPoles) {
        const pBw2   = { re: p.re * Bw / 2, im: p.im * Bw / 2 };
        const disc   = cSub(cMul(pBw2, pBw2), { re: w0 * w0, im: 0 });
        const sqrtD  = cSqrt(disc);
        bpPoles.push(cAdd(pBw2, sqrtD));
        bpPoles.push(cSub(pBw2, sqrtD));
    }

    // ── 4. Bilinear transform: s → z ──────────────────────────────────────
    //    z = (2Fs + s) / (2Fs − s)
    //    Maps the left half s-plane to the interior of the unit z-disk.
    const fs2    = 2 * fs;
    const zPoles = bpPoles.map(s =>
        cDiv({ re: fs2 + s.re, im: s.im },
             { re: fs2 - s.re, im: -s.im })
    );

    // ── 5 & 6. Group into conjugate pairs → SOS sections ──────────────────
    //
    //    For each conjugate pair (p, p*) in the z-plane:
    //      Denominator: (z−p)(z−p*) = z² − 2Re(p)·z + |p|²
    //      In z^{-1}: a = [1, −2Re(p), |p|²]
    //
    //    Bandpass zeros: N at z=+1 (from s=0 through bilinear) and
    //                    N at z=−1 (from s=∞ through bilinear).
    //    Each section gets one zero at z=+1 and one at z=−1:
    //      (z−1)(z+1) = z²−1  →  b = [g, 0, −g]  in z^{-1} form
    //    where g normalises the gain to unity at the passband centre.

    // Digital centre frequency for gain normalisation
    const w0d = 2 * Math.PI * Math.sqrt(lowHz * highHz) / fs;
    const zc  = { re: Math.cos(w0d), im: Math.sin(w0d) };

    const sos  = [];
    const used = new Uint8Array(zPoles.length);

    for (let i = 0; i < zPoles.length; i++) {
        if (used[i]) continue;
        const p = zPoles[i];

        // Only process poles with non-negative imaginary part;
        // their conjugate partner has negative imaginary part.
        if (p.im < -1e-8) continue;

        // Find the best conjugate partner: minimise |q − p*|
        let bestJ = -1, bestDist = Infinity;
        for (let j = 0; j < zPoles.length; j++) {
            if (used[j] || j === i) continue;
            const dist = Math.hypot(zPoles[j].re - p.re, zPoles[j].im + p.im);
            if (dist < bestDist) { bestDist = dist; bestJ = j; }
        }

        used[i] = 1;
        if (bestJ >= 0) used[bestJ] = 1;

        // Biquad denominator coefficients (in z^{-1})
        const a1 = -2 * p.re;
        const a2 = p.re * p.re + p.im * p.im;

        // Gain normalisation: evaluate H_k(zc) = (1 − zc^{-2}) / denom(zc)
        const zcInv  = cDiv({ re: 1, im: 0 }, zc);
        const zcInv2 = cMul(zcInv, zcInv);
        const numVal = cSub({ re: 1, im: 0 }, zcInv2);
        const denVal = cAdd(
            { re: 1, im: 0 },
            cAdd({ re: a1 * zcInv.re,  im: a1 * zcInv.im  },
                 { re: a2 * zcInv2.re, im: a2 * zcInv2.im })
        );

        const gainAtCentre = cAbs(numVal) / (cAbs(denVal) + 1e-300);
        const g = gainAtCentre > 1e-12 ? 1.0 / gainAtCentre : 1.0;

        sos.push({ b: [g, 0.0, -g], a: [1.0, a1, a2] });
    }

    if (sos.length === 0) {
        throw new Error('Filter design produced no SOS sections. Check parameters.');
    }

    return sos;
}

// ─── Filter Application ───────────────────────────────────────────────────────

/**
 * Apply a SOS (cascaded biquad) filter to a signal — causal, forward pass.
 *
 * Each biquad section uses the Direct Form II transposed structure:
 *   y[n] = b0·x[n] + b1·x[n−1] + b2·x[n−2]
 *          − a1·y[n−1] − a2·y[n−2]
 *
 * Filtering is done in Float64 for precision; the output is also Float64.
 * For spectral analysis the causal phase response is acceptable because
 * all information is contained in the magnitude spectrum.
 *
 * @param {Float32Array|Float64Array} signal - Input signal
 * @param {Array<{b:number[], a:number[]}>}  sos - SOS sections from designButterworthSOS()
 * @returns {Float64Array} Filtered signal (same length as input)
 */
function applySOSFilter(signal, sos) {
    const n = signal.length;
    // Work in Float64 for numerical stability during filtering
    const buf = new Float64Array(signal); // copy + promote

    for (const { b, a } of sos) {
        const b0 = b[0], b1 = b[1] ?? 0, b2 = b[2] ?? 0;
        const a1 = a[1] ?? 0, a2 = a[2] ?? 0;
        let x1 = 0, x2 = 0; // delayed input state
        let y1 = 0, y2 = 0; // delayed output state

        for (let i = 0; i < n; i++) {
            const xi = buf[i];
            const yi = b0*xi + b1*x1 + b2*x2 - a1*y1 - a2*y2;
            // Shift states
            x2 = x1; x1 = xi;
            y2 = y1; y1 = yi;
            buf[i] = yi; // in-place
        }
    }

    return buf;
}

/**
 * Evaluate the magnitude frequency response of a SOS filter at a single frequency.
 * Useful for verifying passband/stopband attenuation.
 *
 * @param {Array<{b:number[], a:number[]}>} sos
 * @param {number} freqHz - Frequency in Hz
 * @param {number} fs     - Sampling frequency in Hz
 * @returns {number} Magnitude response (linear, not dB)
 */
function sosFrequencyResponse(sos, freqHz, fs) {
    const w  = 2 * Math.PI * freqHz / fs;
    const zc = { re: Math.cos(w), im: Math.sin(w) };
    let gain = 1.0;
    for (const { b, a } of sos) {
        const numMag = cAbs(evalPolyZInv(b, zc));
        const denMag = cAbs(evalPolyZInv(a, zc));
        gain *= numMag / (denMag + 1e-300);
    }
    return gain;
}

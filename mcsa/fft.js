'use strict';
/**
 * fft.js — Radix-2 Cooley-Tukey FFT
 *
 * In-place DIT (Decimation In Time) FFT for power-of-2 arrays.
 * Operates on Float64Arrays for numerical precision.
 * Exposed as globals so dsp-worker.js can use importScripts().
 *
 * References:
 *   Cooley, J.W. & Tukey, J.W. (1965). "An Algorithm for the Machine
 *   Calculation of Complex Fourier Series." Mathematics of Computation.
 */

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Return the smallest power-of-2 >= n.
 * @param {number} n
 * @returns {number}
 */
function nextPow2(n) {
    if (n <= 1) return 1;
    let p = 1;
    while (p < n) p <<= 1;
    return p;
}

// ─── Bit-reversal Permutation ─────────────────────────────────────────────────

/**
 * In-place bit-reversal permutation.
 * Required by DIT FFT to reorder inputs before butterfly passes.
 * @param {Float64Array} re
 * @param {Float64Array} im
 */
function _bitReverse(re, im) {
    const n = re.length;
    let j = 0;
    for (let i = 1; i < n; i++) {
        let bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) {
            let t = re[i]; re[i] = re[j]; re[j] = t;
            t = im[i]; im[i] = im[j]; im[j] = t;
        }
    }
}

// ─── Core FFT ─────────────────────────────────────────────────────────────────

/**
 * In-place radix-2 DIT FFT (or IFFT).
 *
 * After this call, re[k] and im[k] contain the real and imaginary parts
 * of the k-th DFT bin.  For the forward transform (inverse=false):
 *
 *   X[k] = Σ_{n=0}^{N-1}  x[n] · e^{−j2πkn/N}
 *
 * For the inverse transform (inverse=true), the result is scaled by 1/N.
 *
 * @param {Float64Array} re      - Real parts (modified in-place)
 * @param {Float64Array} im      - Imaginary parts (modified in-place)
 * @param {boolean}      inverse - Compute IFFT if true
 */
function fftInPlace(re, im, inverse = false) {
    const n = re.length;
    if (n === 0) return;
    if ((n & (n - 1)) !== 0) {
        throw new Error(`FFT length must be a power of 2, got ${n}.`);
    }

    _bitReverse(re, im);

    // Sign convention: -1 for FFT (e^{-j2π}), +1 for IFFT
    const sign = inverse ? 1 : -1;

    // Butterfly passes: stride doubles each pass
    for (let stride = 2; stride <= n; stride <<= 1) {
        const half    = stride >>> 1;
        const theta   = sign * 2 * Math.PI / stride;
        // Twiddle factor step: W = e^{j·theta}
        const wBaseRe = Math.cos(theta);
        const wBaseIm = Math.sin(theta);

        for (let start = 0; start < n; start += stride) {
            let tRe = 1.0, tIm = 0.0;          // W^0 = 1
            for (let k = 0; k < half; k++) {
                const u = start + k;
                const v = u + half;
                // Butterfly: (a + W·b, a − W·b)
                const vRe = re[v] * tRe - im[v] * tIm;
                const vIm = re[v] * tIm + im[v] * tRe;
                re[v] = re[u] - vRe;  im[v] = im[u] - vIm;
                re[u] += vRe;         im[u] += vIm;
                // Advance twiddle: t *= W_base
                const newTRe = tRe * wBaseRe - tIm * wBaseIm;
                tIm = tRe * wBaseIm + tIm * wBaseRe;
                tRe = newTRe;
            }
        }
    }

    // IFFT: scale by 1/N
    if (inverse) {
        const inv = 1.0 / n;
        for (let i = 0; i < n; i++) { re[i] *= inv; im[i] *= inv; }
    }
}

// ─── Spectral Utilities ───────────────────────────────────────────────────────

/**
 * Compute the one-sided amplitude spectrum from FFT output.
 *
 * Scaling rules:
 *   k = 0 (DC):       mag = |X[0]| / N          (not doubled)
 *   k = 1..N/2−1:     mag = 2·|X[k]| / N        (doubled for one-sided)
 *   k = N/2 (Nyquist): mag = |X[N/2]| / N        (not doubled)
 *
 * This gives peak amplitude (not RMS).
 *
 * @param {Float64Array} re - FFT real part (length N)
 * @param {Float64Array} im - FFT imaginary part (length N)
 * @returns {Float64Array}  Amplitude spectrum, length N/2 + 1
 */
function fftMagnitudeSpectrum(re, im) {
    const n    = re.length;
    const half = (n >>> 1) + 1;
    const mag  = new Float64Array(half);

    // DC — not doubled
    mag[0] = Math.sqrt(re[0]*re[0] + im[0]*im[0]) / n;

    // Positive frequencies — doubled for one-sided representation
    for (let k = 1; k < half - 1; k++) {
        mag[k] = 2.0 * Math.sqrt(re[k]*re[k] + im[k]*im[k]) / n;
    }

    // Nyquist — not doubled
    if (half > 1) {
        const k = half - 1;
        mag[k] = Math.sqrt(re[k]*re[k] + im[k]*im[k]) / n;
    }

    return mag;
}

/**
 * Generate the frequency axis (Hz) for a one-sided spectrum.
 * Bin k corresponds to frequency k·Fs/N.
 *
 * @param {number} n  - FFT size
 * @param {number} fs - Sampling frequency (Hz)
 * @returns {Float64Array} Frequencies in Hz, length N/2 + 1
 */
function fftFreqAxis(n, fs) {
    const half     = (n >>> 1) + 1;
    const freqs    = new Float64Array(half);
    const binWidth = fs / n;
    for (let k = 0; k < half; k++) freqs[k] = k * binWidth;
    return freqs;
}

/**
 * Find the nearest frequency bin index for a given frequency.
 * @param {Float64Array} freqAxis - Frequency axis from fftFreqAxis()
 * @param {number}       targetHz - Target frequency in Hz
 * @returns {number} Index into freqAxis
 */
function freqToIndex(freqAxis, targetHz) {
    if (freqAxis.length === 0) return 0;
    const binWidth = freqAxis[1] - freqAxis[0];
    const idx = Math.round(targetHz / binWidth);
    return Math.max(0, Math.min(idx, freqAxis.length - 1));
}

/**
 * Apply a Hann window to an array (in-place or returning new Float64Array).
 * w[n] = 0.5 · (1 − cos(2π·n / (N−1)))
 *
 * @param {number} n - Window length
 * @returns {Float64Array} Hann window coefficients
 */
function hannWindow(n) {
    const w = new Float64Array(n);
    const denom = n > 1 ? (n - 1) : 1;
    for (let i = 0; i < n; i++) {
        w[i] = 0.5 * (1.0 - Math.cos(2.0 * Math.PI * i / denom));
    }
    return w;
}

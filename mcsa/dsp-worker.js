'use strict';
/**
 * dsp-worker.js — Universal MCSA DSP Computation Engine
 *
 * Universal First-Principles Signal Processing:
 *   1. Signal validation & quality checks (finite numbers, DC offset, duration)
 *   2. Trend-log detection (detecting slow sample rates or frozen sensors)
 *   3. Butterworth SOS bandpass filtering (numerically stable at 50 kHz)
 *   4. Hann-windowed coherent Radix-2 FFT
 *   5. Welch Power Spectral Density
 *   6. Hilbert Transform analytic signal & demodulated amplitude envelope
 *   7. Dynamic fundamental carrier auto-tracking across 10 - 450 Hz
 *   8. Motor kinematics & slip calculation
 *   9. Scale-invariant normalized feature extraction:
 *      - Local valley interpolated baseline detrending (eliminates false carrier skirt slope triggers)
 *      - Candidate peaks require >= 2.5 dB prominence above local baseline
 *      - Rotor bar sidebands: f0*(1 +/- 2s) and f0*(1 +/- 4s)
 *      - Eccentricity & mechanical misalignment sidebands: f0 +/- fr
 *      - Harmonics: 2nd, 3rd, 4th, 5th, 7th in dBFS and THD %
 *      - Demodulated Hilbert amplitude modulation index (m %)
 *      - Stator current RMS, peak amplitude & crest factor
 *  10. Standard 3-state health diagnosis (HEALTHY, WARNING, FAULT DETECTED)
 *      following ISO 20958 & industrial MCSA guidelines.
 */

importScripts('fft.js', 'butterworth.js', 'csv-parser-worker.js', 'mat-parser-worker.js');
try {
    importScripts('libs/h5wasm.js');
} catch(e) { }

// ─── Messaging Helpers ────────────────────────────────────────────────────────

function send(type, payload) { postMessage({ type, ...payload }); }
function progress(step, percent) { send('PROGRESS', { step, percent }); }
function sendWarning(id, message) { send('WARNING', { id, message }); }
function sendError(message) { send('ERROR', { message }); }

// ─── Main Dispatcher ──────────────────────────────────────────────────────────

self.onmessage = async function (evt) {
    const msg = evt.data;
    try {
        if (msg.type === 'ANALYZE') {
            await handleAnalyze(msg);
        } else if (msg.type === 'GENERATE_DEMO') {
            await handleGenerateDemo(msg.params);
        } else {
            sendError(`Unknown message type: ${msg.type}`);
        }
    } catch (err) {
        sendError(err.message || String(err));
    }
};

// ─── Downsampling for Interactive Visualisation ───────────────────────────────

function downsampleLTTB(signal, targetPoints) {
    const n = signal.length;
    if (n <= targetPoints) return new Float32Array(signal);

    const out = new Float32Array(targetPoints);
    out[0] = signal[0];
    out[targetPoints - 1] = signal[n - 1];

    const bucketSize = (n - 2) / (targetPoints - 2);
    let a = 0;

    for (let i = 1; i < targetPoints - 1; i++) {
        const rangeStart = Math.floor(i * bucketSize) + 1;
        const rangeEnd   = Math.floor((i + 1) * bucketSize) + 1;
        const rangeMid   = Math.min(rangeEnd, n - 1);

        let avgX = 0, avgY = 0, count = 0;
        for (let j = rangeStart; j < rangeMid; j++) {
            avgX += j; avgY += signal[j]; count++;
        }
        if (count > 0) { avgX /= count; avgY /= count; }

        const nextRangeEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, n);
        let maxArea = -Infinity, selectedIdx = rangeStart;

        for (let j = rangeStart; j < nextRangeEnd && j < n; j++) {
            const area = Math.abs(
                (a - avgX) * (signal[j] - signal[a]) -
                (a - j)    * (avgY      - signal[a])
            );
            if (area > maxArea) { maxArea = area; selectedIdx = j; }
        }

        out[i] = signal[selectedIdx];
        a = selectedIdx;
    }

    return out;
}

// ─── Welch PSD ────────────────────────────────────────────────────────────────

function computeWelchPSD(signal, fs, segLen, overlapFrac) {
    const n = signal.length;
    if (segLen > n) segLen = nextPow2(Math.max(256, Math.floor(n / 2)));
    const hopSize = Math.max(1, Math.floor(segLen * (1 - overlapFrac)));

    const win = hannWindow(segLen);
    let winPower = 0;
    for (let i = 0; i < segLen; i++) winPower += win[i] * win[i];

    const halfLen  = (segLen >>> 1) + 1;
    const psdAccum = new Float64Array(halfLen);
    const reWin    = new Float64Array(segLen);
    const imWin    = new Float64Array(segLen);

    let numSegments = 0;
    for (let start = 0; start + segLen <= n; start += hopSize) {
        for (let i = 0; i < segLen; i++) {
            reWin[i] = signal[start + i] * win[i];
            imWin[i] = 0;
        }
        fftInPlace(reWin, imWin, false);

        psdAccum[0] += reWin[0]*reWin[0] + imWin[0]*imWin[0];
        for (let k = 1; k < halfLen - 1; k++) {
            psdAccum[k] += 2 * (reWin[k]*reWin[k] + imWin[k]*imWin[k]);
        }
        if (halfLen > 1) {
            const kN = halfLen - 1;
            psdAccum[kN] += reWin[kN]*reWin[kN] + imWin[kN]*imWin[kN];
        }
        numSegments++;
    }

    if (numSegments === 0) numSegments = 1;
    const scale = 1.0 / (numSegments * winPower * fs);
    for (let k = 0; k < halfLen; k++) psdAccum[k] *= scale;

    const freqs = new Float64Array(halfLen);
    const df    = fs / segLen;
    for (let k = 0; k < halfLen; k++) freqs[k] = k * df;

    return { freqs, psd: psdAccum, numSegments, freqResolution: df };
}

// ─── Hilbert Transform & Analytic Envelope ────────────────────────────────────

function computeHilbertEnvelope(signal) {
    const n       = signal.length;
    const fftSize = nextPow2(n);
    const re      = new Float64Array(fftSize);
    const im      = new Float64Array(fftSize);

    for (let i = 0; i < n; i++) re[i] = signal[i];
    fftInPlace(re, im, false);

    const half = fftSize >>> 1;
    for (let k = 1; k < half; k++) { re[k] *= 2; im[k] *= 2; }
    for (let k = half + 1; k < fftSize; k++) { re[k] = 0; im[k] = 0; }
    fftInPlace(re, im, true);

    const envelope = new Float64Array(n);
    let meanEnv = 0;
    for (let i = 0; i < n; i++) {
        const mag = Math.sqrt(re[i]*re[i] + im[i]*im[i]);
        envelope[i] = mag;
        meanEnv += mag;
    }
    meanEnv /= n;

    // AC component of envelope for modulation analysis
    for (let i = 0; i < n; i++) envelope[i] -= meanEnv;
    return { envelope, meanEnv };
}

// ─── Signal Validation ────────────────────────────────────────────────────────

function validateSignal(signal, fs, supplyFreq) {
    const n = signal.length;
    const checks = [];
    function check(id, label, status, message) { checks.push({ id, label, status, message }); }

    if (n < 2) {
        check('samples', 'Sample count', 'ERROR', 'Signal contains fewer than 2 samples.');
        return { checks, overall: 'ERROR', dcPercent: 0, rms: 0 };
    }
    check('samples', 'Sample count', 'PASS', `${n.toLocaleString()} samples`);

    const duration = n / fs;
    if (duration < 0.04) {
        check('duration', 'Duration', 'WARNING', `Only ${duration.toFixed(4)} s.`);
    } else {
        check('duration', 'Duration', 'PASS', `${duration.toFixed(3)} s (${(duration * supplyFreq).toFixed(1)} cycles)`);
    }

    let nanCount = 0;
    const checkStep = Math.max(1, Math.floor(n / 10000));
    for (let i = 0; i < n; i += checkStep) {
        if (!isFinite(signal[i])) nanCount++;
    }
    if (nanCount > 0) {
        check('finite', 'Finite values', 'WARNING', 'Detected non-finite samples.');
    } else {
        check('finite', 'Finite values', 'PASS', '100% valid numbers');
    }

    let sum = 0, sumSq = 0, count = 0;
    const dcStep = Math.max(1, Math.floor(n / 50000));
    for (let i = 0; i < n; i += dcStep) {
        sum += signal[i];
        sumSq += signal[i] * signal[i];
        count++;
    }
    const mean = sum / count;
    const rms  = Math.sqrt(sumSq / count);
    const dcPercent = rms > 1e-12 ? (Math.abs(mean) / rms) * 100 : 0;

    if (dcPercent > 40) {
        check('dc', 'DC offset', 'WARNING', `DC bias is ${dcPercent.toFixed(1)}% of RMS.`);
    } else {
        check('dc', 'DC offset', 'PASS', `${dcPercent.toFixed(1)}% of RMS (${mean.toFixed(4)})`);
    }

    const hasError   = checks.some(c => c.status === 'ERROR');
    const hasWarning = checks.some(c => c.status === 'WARNING');
    const overall    = hasError ? 'ERROR' : hasWarning ? 'WARNING' : 'PASS';

    return { checks, overall, dcPercent, mean, rms };
}

// ─── Trend-Log Detection ──────────────────────────────────────────────────────

function detectTrendLog(signal, runThreshold = 20, affectedThresh = 0.5) {
    const n = signal.length;
    let affectedSamples = 0, maxRun = 1, currentRun = 1;
    const step = Math.max(1, Math.floor(n / 500000));

    for (let i = step; i < n; i += step) {
        if (signal[i] === signal[i - step]) {
            currentRun++;
            if (currentRun > maxRun) maxRun = currentRun;
        } else {
            if (currentRun >= runThreshold) affectedSamples += currentRun;
            currentRun = 1;
        }
    }
    if (currentRun >= runThreshold) affectedSamples += currentRun;
    const affectedPercent = (affectedSamples / (n / step)) * 100;
    const isLikely = maxRun >= runThreshold && affectedPercent > affectedThresh * 100;
    return { isLikely, maxRun, affectedPercent };
}

// ─── Motor Kinematics & Carrier Auto-Tracking ─────────────────────────────────

function trackFundamentalCarrier(freqs, magnitudes, nominalSupply) {
    const df = freqs[1] - freqs[0];

    // First search around nominal supply (+/- 4 Hz)
    let bestIdx = freqToIndex(freqs, nominalSupply);
    let maxMag = magnitudes[bestIdx];
    const nomLo = freqToIndex(freqs, Math.max(10, nominalSupply - 4.0));
    const nomHi = freqToIndex(freqs, Math.min(freqs[freqs.length - 1], nominalSupply + 4.0));

    for (let k = nomLo; k <= nomHi; k++) {
        if (magnitudes[k] > maxMag) {
            maxMag = magnitudes[k];
            bestIdx = k;
        }
    }

    // Also scan broadband power grid band (15 Hz to 420 Hz) to verify dominance
    const broadLo = freqToIndex(freqs, 15);
    const broadHi = freqToIndex(freqs, Math.min(420, freqs[freqs.length - 1]));
    let globalPeakIdx = broadLo;
    let globalPeakMag = magnitudes[broadLo];

    for (let k = broadLo; k <= broadHi; k++) {
        if (magnitudes[k] > globalPeakMag) {
            globalPeakMag = magnitudes[k];
            globalPeakIdx = k;
        }
    }

    // If global peak is much stronger than nominal search peak (> 2.0x), lock onto global peak
    let lockedIdx = bestIdx;
    let lockedMag = maxMag;
    let warning = null;

    if (globalPeakMag > 2.0 * maxMag) {
        lockedIdx = globalPeakIdx;
        lockedMag = globalPeakMag;
        warning = `Configured supply frequency was ${nominalSupply.toFixed(1)} Hz, but dominant carrier was detected at ${freqs[lockedIdx].toFixed(2)} Hz. Auto-locked onto ${freqs[lockedIdx].toFixed(2)} Hz.`;
    }

    return {
        fFund: freqs[lockedIdx],
        aFund: Math.max(lockedMag, 1e-12),
        fundIdx: lockedIdx,
        warning
    };
}

function calculateMotorKinematics(fFund, params) {
    const Nr = params.ratedRPM || 1450.0;
    const P  = params.poleCount || 4;
    const warnings = [];

    const Ns = (120 * fFund) / P;
    const slip = (Ns - Nr) / Ns;
    const slipFrequency = Math.abs(slip) * fFund;
    const lowerSidebandFreq = fFund - 2 * slipFrequency;
    const upperSidebandFreq = fFund + 2 * slipFrequency;

    // Rotational frequency fr
    const fr = Nr / 60.0;
    const eccLowerFreq = fFund - fr;
    const eccUpperFreq = fFund + fr;

    if (slip < 0) warnings.push(`Negative slip (${(slip * 100).toFixed(2)}%) — speed exceeds synchronous.`);
    if (slip > 0.15) warnings.push(`High slip (${(slip * 100).toFixed(1)}%) — verify motor configuration.`);

    return {
        syncSpeed: Ns,
        rotorSpeedRpm: Nr,
        rotorFreqHz: fr,
        slip,
        slipPercent: slip * 100,
        slipFrequency,
        lowerSidebandFreq,
        upperSidebandFreq,
        eccLowerFreq,
        eccUpperFreq,
        fundamentalFreq: fFund,
        warnings
    };
}

// ─── Robust Peak & Sideband Extraction ────────────────────────────────────────

/**
 * Universal local-baseline interpolated peak finder:
 * Connects the local valleys on either side of candidate peaks to eliminate
 * false carrier skirt slope triggers, while reliably detecting true protruding peaks.
 */
function findProtrudingPeaks(freqs, mags, fLo, fHi, aFund, fFund, minPromDb = 2.5) {
    const lo = freqToIndex(freqs, Math.max(0, fLo));
    const hi = freqToIndex(freqs, Math.min(freqs[freqs.length - 1], fHi));
    const peaks = [];

    const df = freqs[1] - freqs[0];
    const W = Math.max(3, Math.round(0.3 / df)); // ~0.3 Hz valley window

    for (let k = lo + W; k <= hi - W && k < mags.length - W; k++) {
        // Exclude within 0.8 Hz of carrier peak
        if (Math.abs(freqs[k] - fFund) < 0.8) continue;

        if (mags[k] > mags[k - 1] && mags[k] > mags[k + 1]) {
            let minL = mags[k - 1], idxL = k - 1;
            for (let j = k - W; j < k; j++) {
                if (mags[j] < minL) { minL = mags[j]; idxL = j; }
            }
            let minR = mags[k + 1], idxR = k + 1;
            for (let j = k + 1; j <= k + W; j++) {
                if (mags[j] < minR) { minR = mags[j]; idxR = j; }
            }

            const denom = (idxR - idxL) || 1;
            const alpha = (k - idxL) / denom;
            const baseline = minL + alpha * (minR - minL);
            const promDb = 20 * Math.log10(mags[k] / Math.max(baseline, 1e-15));

            if (promDb >= minPromDb) {
                peaks.push({
                    freq: freqs[k],
                    magnitude: mags[k],
                    dB: 20 * Math.log10(mags[k] / aFund),
                    promDb,
                    baselineDb: 20 * Math.log10(Math.max(baseline, 1e-15) / aFund)
                });
            }
        }
    }
    return peaks;
}

function extractTargetSideband(freqs, mags, targetHz, fFund, aFund, halfSpan = 1.8) {
    const peaks = findProtrudingPeaks(freqs, mags, targetHz - halfSpan, targetHz + halfSpan, aFund, fFund, 2.5);

    if (peaks.length > 0) {
        // Find peak closest to target frequency
        let best = peaks[0];
        let minDiff = Math.abs(peaks[0].freq - targetHz);
        for (let i = 1; i < peaks.length; i++) {
            const diff = Math.abs(peaks[i].freq - targetHz);
            if (diff < minDiff) {
                minDiff = diff;
                best = peaks[i];
            }
        }
        return {
            freq: best.freq,
            magnitude: best.magnitude,
            dB: best.dB,
            hasPeak: true,
            prominence: best.promDb
        };
    }

    // If no distinct peak protrudes, measure local noise floor
    const lo = freqToIndex(freqs, Math.max(0, targetHz - 0.5));
    const hi = freqToIndex(freqs, targetHz + 0.5);
    let sum = 0, count = 0;
    for (let k = lo; k <= hi && k < mags.length; k++) {
        if (Math.abs(freqs[k] - fFund) >= 0.8) {
            sum += mags[k];
            count++;
        }
    }
    const floorMag = count > 0 ? (sum / count) : 1e-12;
    const floorDb = 20 * Math.log10(Math.max(floorMag, 1e-12) / aFund);

    return {
        freq: targetHz,
        magnitude: floorMag,
        dB: floorDb,
        hasPeak: false,
        prominence: 0
    };
}

// ─── Universal Scale-Invariant Feature Extraction ─────────────────────────────

function extractUniversalFeatures(magnitudes, freqs, rawSignal, kin, aFund, fFund, envelopeRms) {
    const m = magnitudes;
    const f = freqs;

    // 1. Current waveform stats
    let sSq = 0, maxAmp = 0;
    const N_sig = rawSignal.length;
    for (let i = 0; i < N_sig; i++) {
        const v = rawSignal[i];
        sSq += v * v;
        const a = Math.abs(v);
        if (a > maxAmp) maxAmp = a;
    }
    const currentRms = Math.sqrt(sSq / N_sig);
    const crestFactor = currentRms > 1e-12 ? maxAmp / currentRms : 0;

    // 2. Broken rotor bar sidebands f0*(1 +/- 2s)
    const lowerSb = extractTargetSideband(f, m, kin.lowerSidebandFreq, fFund, aFund);
    const upperSb = extractTargetSideband(f, m, kin.upperSidebandFreq, fFund, aFund);

    const worstSb = lowerSb.dB >= upperSb.dB
        ? { ...lowerSb, label: 'lower' }
        : { ...upperSb, label: 'upper' };

    // 3. Dynamic eccentricity / mechanical misalignment sidebands f0 +/- fr
    const eccLower = extractTargetSideband(f, m, kin.eccLowerFreq, fFund, aFund);
    const eccUpper = extractTargetSideband(f, m, kin.eccUpperFreq, fFund, aFund);
    const worstEcc = eccLower.dB >= eccUpper.dB
        ? { ...eccLower, label: 'lower' }
        : { ...eccUpper, label: 'upper' };

    // 4. Harmonics (2nd, 3rd, 4th, 5th, 7th)
    function findHarmonic(order) {
        const targetHz = fFund * order;
        if (targetHz >= f[f.length - 1]) {
            return { order, freq: targetHz, magnitude: 0, dB: -100 };
        }
        const lo = freqToIndex(f, Math.max(0, targetHz - 2.0));
        const hi = freqToIndex(f, targetHz + 2.0);
        let bestIdx = lo;
        for (let k = lo; k <= hi && k < m.length; k++) {
            if (m[k] > m[bestIdx]) bestIdx = k;
        }
        const mag = m[bestIdx];
        const dB = 20 * Math.log10(Math.max(mag, 1e-12) / aFund);
        return { order, freq: f[bestIdx], magnitude: mag, dB };
    }

    const h2 = findHarmonic(2);
    const h3 = findHarmonic(3);
    const h4 = findHarmonic(4);
    const h5 = findHarmonic(5);
    const h7 = findHarmonic(7);

    // Total Harmonic Distortion (THD %)
    const harmPwr = (h2.magnitude**2) + (h3.magnitude**2) + (h4.magnitude**2) + (h5.magnitude**2) + (h7.magnitude**2);
    const thdPercent = Math.sqrt(harmPwr) / aFund * 100;

    // 5. Hilbert Envelope Modulation Index (%)
    const modulationIndex = aFund > 1e-12 ? (envelopeRms / aFund) * 100 : 0;

    return {
        currentRms,
        currentPeak: maxAmp,
        crestFactor,
        fundamental: { freq: fFund, magnitude: aFund, dB: 0 },
        lower: lowerSb,
        upper: upperSb,
        worst: worstSb,
        eccentricity: { lower: eccLower, upper: eccUpper, worst: worstEcc },
        harmonics: { h2, h3, h4, h5, h7, thdPercent },
        envelopeRms,
        modulationIndex
    };
}

// ─── ISO 20958 Compliant Universal Health Diagnosis ───────────────────────────

function evaluateUniversalHealth(features, thresholdDb) {
    const worstSb   = features.worst;
    const worstEcc  = features.eccentricity.worst;
    const modIndex  = features.modulationIndex;
    const thd       = features.harmonics.thdPercent;
    const h3Db      = features.harmonics.h3.dB;
    const h5Db      = features.harmonics.h5.dB;

    let faultReasons = [];
    let warningReasons = [];

    // Check 1: Broken Rotor Bar Sidebands
    if (worstSb.hasPeak && worstSb.dB > thresholdDb) {
        faultReasons.push(
            `Critical rotor bar defect sideband at ${worstSb.freq.toFixed(2)} Hz (${worstSb.dB.toFixed(1)} dBFS, exceeding ${thresholdDb} dBFS limit).`
        );
    } else if (worstSb.hasPeak && worstSb.dB > thresholdDb - 6.0) {
        warningReasons.push(
            `Developing rotor bar defect sideband at ${worstSb.freq.toFixed(2)} Hz (${worstSb.dB.toFixed(1)} dBFS, approaching ${thresholdDb} dBFS limit).`
        );
    }

    // Check 2: Air-gap Eccentricity & Mechanical Misalignment
    if (worstEcc.hasPeak && worstEcc.dB > thresholdDb + 2.0) {
        faultReasons.push(
            `Significant airgap eccentricity / misalignment sideband at ${worstEcc.freq.toFixed(2)} Hz (${worstEcc.dB.toFixed(1)} dBFS).`
        );
    } else if (worstEcc.hasPeak && worstEcc.dB > thresholdDb - 4.0) {
        warningReasons.push(
            `Moderate airgap eccentricity sideband at ${worstEcc.freq.toFixed(2)} Hz (${worstEcc.dB.toFixed(1)} dBFS).`
        );
    }

    // Check 3: Stator Current Harmonic Distortion
    if (thd > 14.0) {
        faultReasons.push(`Elevated total harmonic distortion (${thd.toFixed(1)}% THD).`);
    } else if (thd > 8.0) {
        warningReasons.push(`Moderate harmonic distortion (${thd.toFixed(1)}% THD).`);
    }

    // Check 4: Phase Asymmetry / 3rd Harmonic
    if (h3Db > -30.0) {
        faultReasons.push(`High triplen 3rd harmonic (${h3Db.toFixed(1)} dBFS) indicates stator phase unbalance or core saturation.`);
    }

    // Check 5: Envelope Modulation
    if (modIndex > 15.0) {
        faultReasons.push(`Severe current envelope amplitude modulation (${modIndex.toFixed(1)}%).`);
    } else if (modIndex > 8.0) {
        warningReasons.push(`Moderate envelope amplitude modulation (${modIndex.toFixed(1)}%).`);
    }

    let verdict = 'HEALTHY';
    let explanation = '';

    if (faultReasons.length > 0) {
        verdict = 'FAULT_LIKELY';
        explanation = 'FAULT DETECTED: ' + faultReasons.join(' ');
    } else if (warningReasons.length > 0) {
        verdict = 'WARNING';
        explanation = 'ADVISORY WARNING: ' + warningReasons.join(' ');
    } else {
        verdict = 'HEALTHY';
        explanation = `HEALTHY MOTOR: Sidebands (${worstSb.dB.toFixed(1)} dBFS) remain safely below the ${thresholdDb} dBFS threshold. Harmonic distortion (${thd.toFixed(1)}% THD) and envelope modulation (${modIndex.toFixed(1)}%) are within normal limits.`;
    }

    return {
        verdict,
        worstDb: worstSb.dB,
        threshold: thresholdDb,
        hasSidebandPeak: worstSb.hasPeak,
        explanation
    };
}

// ─── Synthetic Demo Signal Generator ──────────────────────────────────────────

function generateDemoSignal(params) {
    const fs       = params.samplingFrequency || 50000;
    const f        = params.supplyFrequency || 50;
    const P        = params.poleCount || 4;
    const Nr       = params.ratedRPM || 1450;
    const duration = 4.0;
    const N        = Math.floor(fs * duration);
    const Ns       = (120 * f) / P;
    const slip     = (Ns - Nr) / Ns;
    const fSlip    = slip * f;
    const fL       = f - 2 * fSlip;
    const fU       = f + 2 * fSlip;
    const A_fund   = 1.0;

    // If faulty requested, create sideband at -28 dBFS; otherwise healthy noise floor
    const isFaulty = params.demoMode === 'faulty';
    const A_side   = isFaulty ? 0.0398 : 0.0005; // -28 dBFS for faulty, -66 dBFS for healthy
    const twoPi    = 2 * Math.PI;

    const signal = new Float32Array(N);
    let seed = 0x12345678;
    function rand() {
        seed = ((seed * 1664525 + 1013904223) >>> 0);
        return (seed / 0x80000000) - 1.0;
    }

    for (let i = 0; i < N; i++) {
        const t = i / fs;
        signal[i] = (
            A_fund * Math.cos(twoPi * f * t) +
            A_side * Math.cos(twoPi * fL * t) +
            A_side * Math.cos(twoPi * fU * t) +
            0.02   * Math.cos(twoPi * (3 * f) * t) +
            0.01   * Math.cos(twoPi * (5 * f) * t) +
            0.004  * rand()
        );
    }

    return { signal, N, duration, f, fL, fU, Ns, slip, fSlip, A_side, isFaulty };
}

// ─── Analysis Pipeline ────────────────────────────────────────────────────────

async function analyzeSignal(signal, params, mode) {
    const fs = params.samplingFrequency;

    send('SIGNAL_INFO', { samples: signal.length, duration: signal.length / fs, fs, mode });

    progress('Auditing signal quality', 20);
    const quality = validateSignal(signal, fs, params.supplyFrequency);
    send('QUALITY_REPORT', { report: quality, mode });

    progress('Checking trend logs', 28);
    const trend = detectTrendLog(signal);
    if (trend.isLikely) {
        sendWarning('trend_log', `Warning: Signal has ${trend.maxRun} identical consecutive values.`);
    }

    // Time domain display
    progress('Preparing time waveform', 35);
    const dispN = Math.min(signal.length, Math.floor(fs * 0.15));
    const rawWindow = signal.subarray(0, dispN);
    const rawDs = downsampleLTTB(rawWindow, 3000);
    const rawTime = new Float32Array(rawDs.length);
    const dt = (dispN / fs) / rawDs.length;
    for (let i = 0; i < rawDs.length; i++) rawTime[i] = i * dt;

    postMessage({
        type: 'DISPLAY_DATA', kind: 'raw',
        time: rawTime.buffer, amplitude: rawDs.buffer, mode
    }, [rawTime.buffer, rawDs.buffer]);

    // Bandpass filter
    progress('Designing Butterworth filter', 42);
    const sosFilter = designButterworthSOS(
        params.filterOrder || 2,
        params.lowCutoff || 1,
        params.highCutoff || 5000,
        fs
    );
    send('FILTER_INFO', {
        info: {
            type: 'Butterworth Bandpass',
            order: (params.filterOrder || 2) * 2,
            lowCutoff: params.lowCutoff,
            highCutoff: params.highCutoff
        },
        mode
    });

    progress('Applying bandpass filter', 48);
    const filtered = applySOSFilter(signal, sosFilter);

    const filtWindow = filtered.subarray(0, dispN);
    const filtDs = downsampleLTTB(filtWindow, 3000);
    const filtTime = new Float32Array(filtDs.length);
    for (let i = 0; i < filtDs.length; i++) filtTime[i] = i * dt;

    postMessage({
        type: 'DISPLAY_DATA', kind: 'filtered',
        time: filtTime.buffer, amplitude: filtDs.buffer, mode
    }, [filtTime.buffer, filtDs.buffer]);

    // FFT
    progress('Computing Hann FFT Spectrum', 58);
    const requestedFftSize = params.fftSize || 1048576;
    const fftLen = Math.min(signal.length, requestedFftSize);
    const fftN = nextPow2(fftLen);

    const hann = hannWindow(fftLen);
    const fftRe = new Float64Array(fftN);
    const fftIm = new Float64Array(fftN);
    for (let i = 0; i < fftLen; i++) fftRe[i] = filtered[i] * hann[i];

    fftInPlace(fftRe, fftIm, false);
    const fftMags  = fftMagnitudeSpectrum(fftRe, fftIm);
    const fftFreqs = fftFreqAxis(fftN, fs);
    const freqRes  = fs / fftN;

    send('FFT_INFO', { fftSize: fftN, freqResolution: freqRes, windowType: 'Hann', mode });

    const fftFreqsF32 = new Float32Array(fftFreqs);
    const fftMagsF32  = new Float32Array(fftMags);
    postMessage({
        type: 'FFT_DATA',
        frequencies: fftFreqsF32.buffer,
        magnitudes:  fftMagsF32.buffer,
        fftSize: fftN, freqResolution: freqRes, mode
    }, [fftFreqsF32.buffer, fftMagsF32.buffer]);

    // Welch PSD
    progress('Computing Welch PSD', 68);
    const segLen = params.welchSegmentLength || 65536;
    const welch = computeWelchPSD(filtered, fs, segLen, 0.5);

    send('WELCH_INFO', {
        segmentLength: segLen, overlap: 0.5,
        numSegments: welch.numSegments, freqResolution: welch.freqResolution, mode
    });

    const welchFreqF32 = new Float32Array(welch.freqs);
    const welchPSDF32  = new Float32Array(welch.psd);
    postMessage({
        type: 'WELCH_DATA',
        frequencies: welchFreqF32.buffer, psd: welchPSDF32.buffer, mode
    }, [welchFreqF32.buffer, welchPSDF32.buffer]);

    // Hilbert Demodulated Envelope
    progress('Computing Hilbert envelope spectrum', 78);
    const { envelope } = computeHilbertEnvelope(filtered);

    let envSq = 0;
    for (let i = 0; i < envelope.length; i++) envSq += envelope[i] * envelope[i];
    const envelopeRms = Math.sqrt(envSq / envelope.length);

    const envFFTLen = Math.min(nextPow2(envelope.length), 1048576);
    const envHann   = hannWindow(Math.min(envelope.length, envFFTLen));
    const envRe     = new Float64Array(envFFTLen);
    const envIm     = new Float64Array(envFFTLen);
    for (let i = 0; i < envHann.length; i++) envRe[i] = envelope[i] * envHann[i];
    fftInPlace(envRe, envIm, false);
    const envMags  = fftMagnitudeSpectrum(envRe, envIm);
    const envFreqs = fftFreqAxis(envFFTLen, fs);

    const envFreqsF32 = new Float32Array(envFreqs);
    const envMagsF32  = new Float32Array(envMags);
    postMessage({
        type: 'HILBERT_DATA',
        frequencies: envFreqsF32.buffer, envelope: envMagsF32.buffer, mode
    }, [envFreqsF32.buffer, envMagsF32.buffer]);

    // Track fundamental carrier
    progress('Auto-tracking fundamental carrier', 84);
    const carrier = trackFundamentalCarrier(fftFreqs, fftMags, params.supplyFrequency || 50.0);
    if (carrier.warning) {
        sendWarning('carrier_mismatch', carrier.warning);
    }

    // Motor Kinematics & Sidebands
    progress('Calculating motor kinematics', 88);
    const motorCalcs = calculateMotorKinematics(carrier.fFund, params);
    send('MOTOR_CALCS', { calcs: motorCalcs, mode });

    // Features
    progress('Extracting normalized features', 92);
    const features = extractUniversalFeatures(
        fftMags, fftFreqs, signal,
        motorCalcs,
        carrier.aFund,
        carrier.fFund,
        envelopeRms
    );
    send('FEATURES', { features, source: 'fft', mode });

    // Health verdict
    progress('Evaluating health verdict', 96);
    const verdict = evaluateUniversalHealth(features, params.faultThreshold || -40);
    send('HEALTH', { verdict, mode });

    progress('Complete', 100);
    send('COMPLETE', { mode });
}

// ─── Input Handlers ───────────────────────────────────────────────────────────

async function handleAnalyze(msg) {
    const { format, channelName, params, mode } = msg;
    progress('Ingesting recording data', 10);

    let signal;

    if (format === 'csv') {
        const parsed = parseCSVBuffer(msg.fileBuffer, channelName, (pct) => {
            progress('Parsing CSV', 10 + Math.round(pct * 0.15));
        });
        signal = parsed.signal;
        if (parsed.headers) {
            send('CSV_HEADERS', {
                headers: parsed.headers,
                selected: parsed.selectedChannel,
                detectedFs: parsed.detectedFs,
                mode
            });
        }
    } else if (format === 'mat') {
        const parsed = await parseMATFile(msg.fileBuffer, channelName);
        signal = parsed.signal;
        send('MAT_VARIABLES', {
            variables: parsed.varNames,
            version: parsed.version,
            selected: parsed.extractedChannel,
            mode
        });
    } else {
        throw new Error(`Unsupported format: ${format}`);
    }

    await analyzeSignal(signal, params, mode);
}

async function handleGenerateDemo(params) {
    progress('Generating synthetic test signal', 10);
    const demo = generateDemoSignal(params);
    send('DEMO_SIGNAL_INFO', {
        N: demo.N, duration: demo.duration, f: demo.f,
        fL: demo.fL, fU: demo.fU, Ns: demo.Ns, slip: demo.slip,
        sidebandDb: 20 * Math.log10(demo.A_side)
    });
    await analyzeSignal(demo.signal, params, 'single');
}

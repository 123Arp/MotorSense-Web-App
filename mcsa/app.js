'use strict';
/**
 * app.js — Universal MCSA Application Controller
 *
 * Professional Dark Telemetry Instrumentation Controller:
 *   • Universal file ingestion (ANY CSV or MATLAB .mat file)
 *   • Delimiter & header detection, time-column auto-sampling frequency (Fs)
 *   • Dynamic channel & variable discovery for single or multi-column data
 *   • Scale-invariant telemetry dashboard (RMS, dBFS, Modulation Index, THD, Eccentricity)
 *   • Dark Plotly visualization with interactive sideband markers
 *   • Generalized comparison mode with feature deltas
 *   • JSON diagnostic report export
 */

// ─── Application State ────────────────────────────────────────────────────────

const state = {
    file:          null,
    fileBuffer:    null,
    format:        null,
    channelName:   'I1',
    worker:        null,
    isProcessing:  false,
    results:       {},

    cmp: {
        healthy: { file: null, buffer: null, format: null, results: {}, channel: 'I1' },
        faulty:  { file: null, buffer: null, format: null, results: {}, channel: 'I1' }
    },

    charts: {}
};

// ─── Worker Lifecycle ─────────────────────────────────────────────────────────

function createWorker() {
    if (state.worker) { state.worker.terminate(); }
    state.worker = new Worker('dsp-worker.js');
    state.worker.onmessage = handleWorkerMessage;
    state.worker.onerror = (e) => {
        showError(`Worker computational error: ${e.message}`);
        setProcessing(false);
    };
    return state.worker;
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

function gv(id) { return document.getElementById(id); }
function numVal(id, fallback = 0) {
    const v = parseFloat(gv(id)?.value);
    return isFinite(v) ? v : fallback;
}

function collectParams() {
    return {
        samplingFrequency:   numVal('p-fs',          50000),
        supplyFrequency:     numVal('p-supply',       50),
        ratedRPM:            numVal('p-rpm',          1450),
        poleCount:           parseInt(gv('p-poles').value) || 4,
        lowCutoff:           numVal('p-lowcut',       1),
        highCutoff:          numVal('p-highcut',      5000),
        faultThreshold:      numVal('p-threshold',   -40),
        fftSize:             parseInt(gv('p-fftsize').value) || 1048576,
        welchSegmentLength:  parseInt(gv('p-welseg').value)  || 65536,
        welchOverlap:        0.5,
        filterOrder:         parseInt(gv('p-filterorder').value) || 2,
    };
}

// ─── Universal File Ingestion ─────────────────────────────────────────────────

function detectFormat(name) {
    if (name.toLowerCase().endsWith('.mat')) return 'mat';
    return 'csv';
}

function formatBytes(b) {
    if (b < 1024)       return `${b} B`;
    if (b < 1024*1024)  return `${(b/1024).toFixed(1)} KB`;
    return `${(b/1024/1024).toFixed(1)} MB`;
}

async function handleFileSelected(file, mode = 'single') {
    if (!file) return;
    const format = detectFormat(file.name);
    const buf = await readFileBuffer(file);

    if (mode === 'single') {
        state.file       = file;
        state.format     = format;
        state.fileBuffer = buf;

        gv('fi-name').textContent     = file.name;
        gv('fi-size').textContent     = formatBytes(file.size);
        gv('fi-format').textContent   = format.toUpperCase() + (format === 'mat' ? ' (MATLAB Data)' : ' (Delimited / CSV)');
        gv('fi-samples').textContent  = '— (analyzing...)';
        gv('fi-duration').textContent = '—';
        gv('fi-fs').textContent       = `${numVal('p-fs', 50000).toLocaleString()} Hz`;
        gv('fileInfo').hidden = false;

        buildChannelPicker(['I1', 'I2', 'I3'], 'I1');
        gv('channelPicker').hidden = false;
        gv('btnRun').disabled = false;
    } else {
        state.cmp[mode].file   = file;
        state.cmp[mode].buffer = buf;
        state.cmp[mode].format = format;
        const infoEl = gv(mode + 'FileInfo');
        if (infoEl) {
            infoEl.innerHTML = `<table class="info-table"><tbody>
              <tr><td>File</td><td>${file.name}</td></tr>
              <tr><td>Size</td><td>${formatBytes(file.size)}</td></tr>
              <tr><td>Format</td><td>${format.toUpperCase()}</td></tr>
            </tbody></table>`;
            infoEl.hidden = false;
        }
        gv('btnRun' + capitalize(mode)).disabled = false;
    }
}

function readFileBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error(`Could not read file '${file.name}'`));
        reader.readAsArrayBuffer(file);
    });
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ─── Dynamic Channel Selector ─────────────────────────────────────────────────

const CURRENT_PREFIXES = ['i', 'curr', 'phase', 'ia', 'ib', 'ic', 'amp', 'stator'];
const VIBRATION_PREFIXES = ['x', 'y', 'z', 'vib', 'acc'];

function buildChannelPicker(channels, defaultChannel) {
    const container = gv('channelRadios');
    container.innerHTML = '';

    for (const ch of channels) {
        const lower = ch.toLowerCase();
        const isCurrent   = CURRENT_PREFIXES.some(p => lower.startsWith(p) || lower.includes(p));
        const isVibration = VIBRATION_PREFIXES.some(p => lower === p || lower.startsWith(p + '_'));

        const label = document.createElement('label');
        if (isCurrent)   label.className = 'current-channel';
        if (isVibration) label.className = 'vib-channel';

        const radio = document.createElement('input');
        radio.type  = 'radio';
        radio.name  = 'channelSelect';
        radio.value = ch;
        if (ch.toLowerCase() === (defaultChannel || '').toLowerCase()) {
            radio.checked = true;
            state.channelName = ch;
        }
        radio.addEventListener('change', () => {
            state.channelName = ch;
        });

        label.appendChild(radio);
        label.append(` ${ch}`);
        if (isCurrent)   label.append(' ★ Current');
        if (isVibration) label.append(' (Vib)');
        container.appendChild(label);
    }
}

// ─── Progress Pipeline ────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
    { id: 'file',     label: 'File Ingestion & Variable Discovery' },
    { id: 'quality',  label: 'Signal Validation & Quality Audit'   },
    { id: 'filter',   label: 'Butterworth Bandpass Filtering (SOS)'},
    { id: 'fft',      label: 'Hann-Windowed FFT Spectrum'          },
    { id: 'welch',    label: 'Welch Power Spectral Density'        },
    { id: 'hilbert',  label: 'Hilbert Analytic Demodulation'       },
    { id: 'carrier',  label: 'Fundamental Carrier Tracking'        },
    { id: 'features', label: 'Harmonics & Sideband Extraction'     },
    { id: 'health',   label: 'Scale-Invariant Health Diagnosis'    }
];

function initProgress() {
    const container = gv('progressSteps');
    container.innerHTML = '';
    for (const step of PIPELINE_STEPS) {
        const div = document.createElement('div');
        div.className = 'progress-step pending';
        div.id = `pstep-${step.id}`;
        div.innerHTML = `<span class="ps-icon">○</span><span>${step.label}</span>`;
        container.appendChild(div);
    }
    gv('panel-progress').hidden = false;
    gv('progressBar').style.width = '0%';
}

function updateProgress(step, percent) {
    gv('progressBar').style.width = `${percent}%`;
    const s = step.toLowerCase();
    let act = 'file';

    if (s.includes('qual') || s.includes('audit') || s.includes('trend')) act = 'quality';
    else if (s.includes('filt') || s.includes('butter'))                   act = 'filter';
    else if (s.includes('fft') || s.includes('hann'))                      act = 'fft';
    else if (s.includes('welch') || s.includes('psd'))                     act = 'welch';
    else if (s.includes('hilbert') || s.includes('demod'))                 act = 'hilbert';
    else if (s.includes('carrier') || s.includes('tracking'))              act = 'carrier';
    else if (s.includes('feature') || s.includes('sideband') || s.includes('harmonic')) act = 'features';
    else if (s.includes('health') || s.includes('complete'))               act = 'health';

    for (const st of PIPELINE_STEPS) {
        const el = gv(`pstep-${st.id}`);
        if (!el) continue;
        const idx = PIPELINE_STEPS.indexOf(st);
        const actIdx = PIPELINE_STEPS.findIndex(x => x.id === act);

        if (idx < actIdx || percent >= 100) {
            el.className = 'progress-step done';
            el.querySelector('.ps-icon').textContent = '✓';
        } else if (st.id === act) {
            el.className = 'progress-step active';
            el.querySelector('.ps-icon').textContent = '▶';
        } else {
            el.className = 'progress-step pending';
            el.querySelector('.ps-icon').textContent = '○';
        }
    }
}

// ─── Worker Message Dispatcher ────────────────────────────────────────────────

const seenWarnings = new Set();
function addWarning(id, text, level = 'WARNING') {
    if (seenWarnings.has(id)) return;
    seenWarnings.add(id);
    const list = gv('warningsList');
    const div = document.createElement('div');
    div.className = `warning-item ${level}`;
    div.textContent = text;
    list.appendChild(div);
    gv('warningsArea').hidden = false;
}

function handleWorkerMessage(e) {
    const msg  = e.data;
    const mode = msg.mode || 'single';

    switch (msg.type) {
        case 'PROGRESS':
            if (mode === 'single') updateProgress(msg.step, msg.percent);
            break;

        case 'ERROR':
            showError(msg.message);
            setProcessing(false);
            break;

        case 'WARNING':
            addWarning(msg.id, msg.message, 'WARNING');
            break;

        case 'SIGNAL_INFO':
            handleSignalInfo(msg);
            break;

        case 'QUALITY_REPORT':
            renderQualityReport(msg.report);
            break;

        case 'FILTER_INFO':
            gv('filterInfo').innerHTML =
                `<span>Type: ${msg.info.type}</span>` +
                `<span>Order: ${msg.info.order}th</span>` +
                `<span>Passband: ${msg.info.lowCutoff} Hz &ndash; ${msg.info.highCutoff} Hz</span>`;
            break;

        case 'FFT_INFO':
            gv('fftInfo').innerHTML =
                `<span>Window: ${msg.windowType}</span>` +
                `<span>Bins: ${msg.fftSize.toLocaleString()}</span>` +
                `<span>Resolution Δf: ${msg.freqResolution.toFixed(4)} Hz</span>`;
            break;

        case 'DISPLAY_DATA':
            handleDisplayData(msg, mode);
            break;

        case 'FFT_DATA':
            handleFFTData(msg, mode);
            break;

        case 'WELCH_DATA':
            handleWelchData(msg, mode);
            break;

        case 'WELCH_INFO':
            gv('welchInfo').innerHTML =
                `<span>Segment: ${msg.segmentLength.toLocaleString()}</span>` +
                `<span>Overlap: ${(msg.overlap*100).toFixed(0)}%</span>` +
                `<span>Segments: ${msg.numSegments}</span>` +
                `<span>Δf: ${msg.freqResolution.toFixed(4)} Hz</span>`;
            break;

        case 'HILBERT_DATA':
            handleHilbertData(msg, mode);
            break;

        case 'MOTOR_CALCS':
            handleMotorCalcs(msg.calcs, mode);
            break;

        case 'FEATURES':
            handleFeatures(msg, mode);
            break;

        case 'HEALTH':
            handleHealth(msg.verdict, mode);
            break;

        case 'MAT_VARIABLES':
            if (msg.variables && msg.variables.length > 0) {
                buildChannelPicker(msg.variables, msg.selected || msg.variables[0]);
                gv('channelPicker').hidden = false;
            }
            break;

        case 'CSV_HEADERS':
            if (msg.headers && msg.headers.length > 0) {
                buildChannelPicker(msg.headers, msg.selected || msg.headers[0]);
                gv('channelPicker').hidden = false;
            }
            if (msg.detectedFs) {
                gv('p-fs').value = msg.detectedFs;
                addWarning('auto_fs', `Auto-detected sampling rate: ${msg.detectedFs.toLocaleString()} Hz from time column.`, 'INFO');
            }
            break;

        case 'DEMO_SIGNAL_INFO':
            addWarning('demo', `Synthetic motor signal generated (${msg.f} Hz carrier, injected sideband: ${msg.sidebandDb.toFixed(1)} dBFS)`, 'INFO');
            gv('fi-name').textContent = 'Synthetic Test Motor Signal';
            gv('fi-size').textContent = `${msg.N.toLocaleString()} samples (${msg.duration.toFixed(1)} s)`;
            gv('fi-format').textContent = 'Synthesized Waveform';
            gv('fileInfo').hidden = false;
            break;

        case 'COMPLETE':
            setProcessing(false);
            gv('btnExport').disabled = false;
            if (mode === 'single') showSection('panel-methods', true);
            if (mode === 'healthy' || mode === 'faulty') tryRenderComparison();
            break;
    }
}

// ─── UI Visualizers ───────────────────────────────────────────────────────────

function handleSignalInfo(msg) {
    const { samples, duration, fs } = msg;
    gv('fi-samples').textContent  = samples.toLocaleString();
    gv('fi-duration').textContent = `${duration.toFixed(3)} s`;
    gv('fi-fs').textContent       = `${fs.toLocaleString()} Hz`;

    gv('rawInfo').innerHTML =
        `<span>Channel: ${state.channelName}</span>` +
        `<span>Samples: ${samples.toLocaleString()}</span>` +
        `<span>Duration: ${duration.toFixed(3)} s</span>` +
        `<span>Fs: ${fs.toLocaleString()} Hz</span>`;
    state.results.signalInfo = { samples, duration, fs };
}

function handleDisplayData(msg, mode) {
    const time = Array.from(new Float32Array(msg.time));
    const amp  = Array.from(new Float32Array(msg.amplitude));

    if (mode === 'single') {
        if (msg.kind === 'raw') {
            showSection('panel-raw', true);
            plotDarkTimeDomain('chart-raw', time, amp, 'Raw Stator Current Waveform', 'Current');
        } else if (msg.kind === 'filtered') {
            showSection('panel-filtered', true);
            plotDarkTimeDomain('chart-filtered', time, amp, 'Bandpass Filtered Current (SOS)', 'Current');
        }
    }
}

function handleFFTData(msg, mode) {
    const freqs = new Float32Array(msg.frequencies);
    const mags  = new Float32Array(msg.magnitudes);
    const params = collectParams();
    const motorC = calcMotorParams(params);
    const markers = makeSidebandMarkers(motorC);

    if (mode === 'single') {
        showSection('panel-fft', true);
        state.charts.fft = { freqs, mags, markers };
        plotDarkSpectrum('chart-fft', freqs, mags, 'FFT Amplitude Spectrum', 'Amplitude', markers, params.supplyFrequency, 15, false);
    } else {
        state.cmp[mode].results.fft = { freqs, mags };
    }
}

function handleWelchData(msg, mode) {
    const freqs = new Float32Array(msg.frequencies);
    const psd   = new Float32Array(msg.psd);
    const params = collectParams();
    const motorC = calcMotorParams(params);
    const markers = makeSidebandMarkers(motorC);

    if (mode === 'single') {
        showSection('panel-welch', true);
        state.charts.welch = { freqs, psd, markers };
        plotDarkSpectrum('chart-welch', freqs, psd, 'Welch Power Spectral Density', 'Power Density (A²/Hz)', markers, params.supplyFrequency, 15, true);
    } else {
        state.cmp[mode].results.welch = { freqs, psd };
    }
}

function handleHilbertData(msg, mode) {
    const freqs = new Float32Array(msg.frequencies);
    const env   = new Float32Array(msg.envelope);
    const params = collectParams();
    const motorC = calcMotorParams(params);
    const markers = makeEnvelopeMarkers(motorC);

    if (mode === 'single') {
        showSection('panel-hilbert', true);
        state.charts.hilbert = { freqs, env, markers };
        plotDarkSpectrum('chart-hilbert', freqs, env, 'Hilbert Demodulated Amplitude Envelope', 'Modulation Amplitude', markers, 0, 50, false);
    } else {
        state.cmp[mode].results.hilbert = { freqs, env };
    }
}

function handleMotorKinematics(calcs, mode) {
    if (mode === 'single') {
        showSection('panel-kinematics', true);
        renderKinematicsReport(calcs);
    }
    state.results.motorCalcs = calcs;
}

function handleMotorCalcs(calcs, mode) {
    handleMotorKinematics(calcs, mode);
}

function handleFeatures(msg, mode) {
    const f = msg.features;
    state.results.features = f;

    if (mode !== 'single') {
        state.cmp[mode].results.features = f;
        return;
    }

    showSection('panel-kpi', true);
    showSection('panel-features', true);

    gv('kpi-rms').textContent = `${f.currentRms.toFixed(4)} A`;
    gv('kpi-rms-sub').textContent = `Peak: ${f.currentPeak.toFixed(3)} A &bull; CF: ${f.crestFactor.toFixed(2)}`;

    gv('kpi-fund').textContent = `${f.fundamental.magnitude.toFixed(4)} A`;
    gv('kpi-fund-freq').textContent = `Locked @ ${f.fundamental.freq.toFixed(2)} Hz`;

    const worstSb = f.worst;
    gv('kpi-sb').textContent = `${worstSb.dB.toFixed(1)} dBFS`;
    gv('kpi-sb').style.color = (worstSb.hasPeak && worstSb.dB > collectParams().faultThreshold) ? 'var(--red)' : 'var(--green)';
    gv('kpi-sb-sub').textContent = worstSb.hasPeak ? `★ Peak @ ${worstSb.freq.toFixed(2)} Hz` : 'Noise floor (no peak)';

    const ecc = f.eccentricity ? f.eccentricity.worst : null;
    if (ecc && gv('kpi-ecc')) {
        gv('kpi-ecc').textContent = `${ecc.dB.toFixed(1)} dBFS`;
        gv('kpi-ecc').style.color = (ecc.hasPeak && ecc.dB > collectParams().faultThreshold + 2) ? 'var(--red)' : 'var(--green)';
        gv('kpi-ecc-sub').textContent = ecc.hasPeak ? `★ Peak @ ${ecc.freq.toFixed(2)} Hz` : 'Noise floor (no peak)';
    }

    gv('kpi-h5').textContent = `${f.harmonics.h5.dB.toFixed(1)} dBFS`;
    gv('kpi-h5').style.color = f.harmonics.h5.dB > -35.0 ? 'var(--red)' : 'var(--green)';

    gv('kpi-env').textContent = `${f.modulationIndex.toFixed(1)}%`;
    gv('kpi-thd').textContent = `${f.harmonics.thdPercent.toFixed(2)}%`;

    renderFeatureTable(f, 'featureTableWrap');
}

function renderFeatureTable(f, containerId) {
    const thresh = collectParams().faultThreshold;
    const dbClass = (db, hasPeak) => (hasPeak && db > thresh) ? 'db-fault' : (hasPeak && db > thresh - 6) ? 'db-warning' : 'db-negative';

    const ecc = f.eccentricity || { lower: { freq: 0, magnitude: 0, dB: -100, hasPeak: false }, upper: { freq: 0, magnitude: 0, dB: -100, hasPeak: false } };

    const html = `
        <table class="feature-table" aria-label="Extracted spectral harmonics table">
          <thead><tr>
            <th>Diagnostic Feature</th>
            <th>Frequency (Hz)</th>
            <th>Amplitude</th>
            <th>Relative Level (dBFS)</th>
            <th>Peak Detection Status</th>
          </tr></thead>
          <tbody>
            <tr>
              <td>Fundamental Carrier (f0)</td>
              <td>${f.fundamental.freq.toFixed(2)}</td>
              <td>${f.fundamental.magnitude.toFixed(4)}</td>
              <td>0.0 dBFS</td>
              <td style="color:var(--accent)">★ Tracked Carrier Peak</td>
            </tr>
            <tr class="${f.worst.label === 'lower' ? 'worst-row' : ''}">
              <td>Rotor Bar Lower Sideband f0(1 - 2s)</td>
              <td>${f.lower.freq.toFixed(2)}</td>
              <td>${f.lower.magnitude.toExponential(3)}</td>
              <td class="${dbClass(f.lower.dB, f.lower.hasPeak)}">${f.lower.dB.toFixed(1)} dBFS</td>
              <td>${f.lower.hasPeak ? '★ Distinct Local Peak (' + f.lower.prominence.toFixed(1) + ' dB SNR)' : 'Noise Floor (No Peak)'}</td>
            </tr>
            <tr class="${f.worst.label === 'upper' ? 'worst-row' : ''}">
              <td>Rotor Bar Upper Sideband f0(1 + 2s)</td>
              <td>${f.upper.freq.toFixed(2)}</td>
              <td>${f.upper.magnitude.toExponential(3)}</td>
              <td class="${dbClass(f.upper.dB, f.upper.hasPeak)}">${f.upper.dB.toFixed(1)} dBFS</td>
              <td>${f.upper.hasPeak ? '★ Distinct Local Peak (' + f.upper.prominence.toFixed(1) + ' dB SNR)' : 'Noise Floor (No Peak)'}</td>
            </tr>
            <tr>
              <td>Eccentricity / Misalignment Lower (f0 - fr)</td>
              <td>${ecc.lower.freq.toFixed(2)}</td>
              <td>${ecc.lower.magnitude.toExponential(3)}</td>
              <td class="${dbClass(ecc.lower.dB, ecc.lower.hasPeak)}">${ecc.lower.dB.toFixed(1)} dBFS</td>
              <td>${ecc.lower.hasPeak ? '★ Distinct Peak' : 'Noise Floor (No Peak)'}</td>
            </tr>
            <tr>
              <td>Eccentricity / Misalignment Upper (f0 + fr)</td>
              <td>${ecc.upper.freq.toFixed(2)}</td>
              <td>${ecc.upper.magnitude.toExponential(3)}</td>
              <td class="${dbClass(ecc.upper.dB, ecc.upper.hasPeak)}">${ecc.upper.dB.toFixed(1)} dBFS</td>
              <td>${ecc.upper.hasPeak ? '★ Distinct Peak' : 'Noise Floor (No Peak)'}</td>
            </tr>
            <tr>
              <td>3rd Harmonic (Triplen / Unbalance)</td>
              <td>${f.harmonics.h3.freq.toFixed(2)}</td>
              <td>${f.harmonics.h3.magnitude.toExponential(3)}</td>
              <td class="${f.harmonics.h3.dB > -35 ? 'db-fault' : 'db-negative'}">${f.harmonics.h3.dB.toFixed(1)} dBFS</td>
              <td>${f.harmonics.h3.dB > -35 ? 'Elevated' : 'Nominal'}</td>
            </tr>
            <tr>
              <td>5th Harmonic (Negative Sequence Flux)</td>
              <td>${f.harmonics.h5.freq.toFixed(2)}</td>
              <td>${f.harmonics.h5.magnitude.toExponential(3)}</td>
              <td class="${f.harmonics.h5.dB > -38 ? 'db-warning' : 'db-negative'}">${f.harmonics.h5.dB.toFixed(1)} dBFS</td>
              <td>${f.harmonics.h5.dB > -38 ? 'Elevated' : 'Nominal'}</td>
            </tr>
            <tr>
              <td>Total Harmonic Distortion (THD)</td>
              <td>—</td>
              <td>—</td>
              <td class="${f.harmonics.thdPercent > 10 ? 'db-warning' : 'db-negative'}">${f.harmonics.thdPercent.toFixed(2)}%</td>
              <td>${f.harmonics.thdPercent > 14 ? 'High Distortion' : 'Normal Distortion'}</td>
            </tr>
          </tbody>
        </table>`;
    gv(containerId).innerHTML = html;
}

function handleHealth(verdict, mode) {
    if (mode !== 'single') {
        state.cmp[mode].results.verdict = verdict;
        const el = gv(mode + 'Verdict');
        if (el) {
            const isH = verdict.verdict === 'HEALTHY';
            const isW = verdict.verdict === 'WARNING';
            const col = isH ? 'var(--green)' : isW ? 'var(--amber)' : 'var(--red)';
            el.innerHTML = `<span style="color:${col};font-weight:700">● ${verdict.verdict.replace('_',' ')}</span> &bull; SB: ${verdict.worstDb.toFixed(1)} dBFS`;
        }
        return;
    }

    state.results.verdict = verdict;
    showSection('panel-health', true);

    let badgeClass = 'HEALTHY';
    let badgeTitle = '● HEALTHY MOTOR';
    if (verdict.verdict === 'WARNING') {
        badgeClass = 'WARNING';
        badgeTitle = '▲ ADVISORY: DEVELOPING ANOMALY';
    } else if (verdict.verdict === 'FAULT_LIKELY') {
        badgeClass = 'FAULT_LIKELY';
        badgeTitle = '▲ CRITICAL FAULT DETECTED';
    }

    gv('healthVerdict').innerHTML = `
        <div class="verdict-box ${badgeClass}" role="alert">
          <div class="verdict-label">${badgeTitle}</div>
          <div class="verdict-sub">${verdict.explanation}</div>
        </div>
        <div class="verdict-detail">
          <span class="vd-key">Configured Fault Threshold:</span> <span class="vd-val">${verdict.threshold} dBFS</span>
          <span class="vd-key">Evaluated Sideband Level:</span>    <span class="vd-val">${verdict.worstDb.toFixed(1)} dBFS</span>
          <span class="vd-key">Sideband Distinct Peak:</span>      <span class="vd-val">${verdict.hasSidebandPeak ? 'YES (Protruding Peak)' : 'NO (Within Noise Floor)'}</span>
        </div>`;
}

// ─── Plotly Visualization ─────────────────────────────────────────────────────

const PLOTLY_DARK_LAYOUT = {
    paper_bgcolor: '#0a0f1d',
    plot_bgcolor:  '#06090f',
    font: { family: 'Consolas, monospace', size: 10, color: '#94a3b8' },
    xaxis: {
        zeroline: false,
        gridcolor: 'rgba(255, 255, 255, 0.08)',
        tickcolor: 'rgba(255, 255, 255, 0.25)',
        linecolor: 'rgba(255, 255, 255, 0.2)'
    },
    yaxis: {
        zeroline: false,
        gridcolor: 'rgba(255, 255, 255, 0.08)',
        tickcolor: 'rgba(255, 255, 255, 0.25)',
        linecolor: 'rgba(255, 255, 255, 0.2)'
    },
    margin: { l: 60, r: 25, t: 35, b: 45 },
    showlegend: true,
    legend: { x: 1, y: 1, xanchor: 'right', font: { size: 10, color: '#e2e8f0' }, bgcolor: 'rgba(11,17,32,0.85)' }
};

const PLOTLY_CONFIG = { responsive: true, displayModeBar: true, scrollZoom: true };

function plotDarkTimeDomain(containerId, xArr, yArr, title, yLabel) {
    const trace = {
        x: xArr, y: yArr,
        type: 'scatter', mode: 'lines',
        line: { color: '#38bdf8', width: 1.2 },
        name: 'Stator Current'
    };
    const layout = {
        ...PLOTLY_DARK_LAYOUT,
        title: { text: title, font: { size: 12, color: '#f8fafc' }, x: 0.02 },
        xaxis: { ...PLOTLY_DARK_LAYOUT.xaxis, title: { text: 'Time (s)', font: { size: 10 } } },
        yaxis: { ...PLOTLY_DARK_LAYOUT.yaxis, title: { text: `${yLabel} (A)`, font: { size: 10 } } }
    };
    Plotly.react(containerId, [trace], layout, PLOTLY_CONFIG);
}

function plotDarkSpectrum(containerId, freqs, values, title, yLabel, markers, centerHz, spanHz, isPsd) {
    const N = freqs.length;
    let maxPts = 4000;
    let step = Math.max(1, Math.floor(N / maxPts));

    let fSub = [], vSub = [];
    for (let i = 0; i < N; i += step) {
        fSub.push(freqs[i]);
        vSub.push(values[i]);
    }

    let fundMag = 1.0;
    if (!isPsd) {
        let maxV = 0;
        for (let i = 0; i < values.length; i++) if (values[i] > maxV) maxV = values[i];
        fundMag = Math.max(maxV, 1e-12);
    }

    const yVals = isPsd
        ? vSub.map(v => 10 * Math.log10(Math.max(v, 1e-15)))
        : vSub.map(v => 20 * Math.log10(Math.max(v, 1e-12) / fundMag));

    const mainTrace = {
        x: fSub, y: yVals,
        type: 'scatter', mode: 'lines',
        line: { color: isPsd ? '#a855f7' : '#38bdf8', width: 1.2 },
        name: isPsd ? 'PSD (dB)' : 'Amplitude (dBFS)'
    };

    const data = [mainTrace];

    if (markers && markers.length > 0) {
        const mx = markers.map(m => m.freq);
        const my = markers.map(m => {
            let idx = Math.round(m.freq / (freqs[1] - freqs[0]));
            idx = Math.max(0, Math.min(idx, values.length - 1));
            return isPsd
                ? 10 * Math.log10(Math.max(values[idx], 1e-15))
                : 20 * Math.log10(Math.max(values[idx], 1e-12) / fundMag);
        });

        data.push({
            x: mx, y: my,
            type: 'scatter', mode: 'markers+text',
            text: markers.map(m => m.label),
            textposition: 'top center',
            textfont: { color: '#f59e0b', size: 9 },
            marker: { color: '#f59e0b', size: 7, symbol: 'triangle-down' },
            name: 'Fault Targets'
        });
    }

    const layout = {
        ...PLOTLY_DARK_LAYOUT,
        title: { text: title, font: { size: 12, color: '#f8fafc' }, x: 0.02 },
        xaxis: {
            ...PLOTLY_DARK_LAYOUT.xaxis,
            title: { text: 'Frequency (Hz)', font: { size: 10 } },
            range: centerHz > 0 ? [centerHz - spanHz, centerHz + spanHz] : [0, spanHz]
        },
        yaxis: {
            ...PLOTLY_DARK_LAYOUT.yaxis,
            title: { text: isPsd ? 'PSD (dB/Hz)' : 'Magnitude (dBFS)', font: { size: 10 } }
        }
    };

    Plotly.react(containerId, data, layout, PLOTLY_CONFIG);
}

// ─── Motor Kinematics Calculations ────────────────────────────────────────────

function calcMotorParams(p) {
    const f = p.supplyFrequency || 50;
    const Nr = p.ratedRPM || 1450;
    const P = p.poleCount || 4;
    const Ns = (120 * f) / P;
    const slip = (Ns - Nr) / Ns;
    const slipFreq = Math.abs(slip) * f;
    const fr = Nr / 60.0;
    return {
        f, Nr, P, Ns, slip, slipFreq,
        fL: f - 2 * slipFreq,
        fU: f + 2 * slipFreq,
        eccL: f - fr,
        eccU: f + fr
    };
}

function makeSidebandMarkers(c) {
    return [
        { freq: c.f,   label: 'f0 (Carrier)' },
        { freq: c.fL,  label: 'f0 - 2sf0 (BRB)' },
        { freq: c.fU,  label: 'f0 + 2sf0 (BRB)' },
        { freq: c.eccL, label: 'f0 - fr (Ecc)' },
        { freq: c.eccU, label: 'f0 + fr (Ecc)' }
    ];
}

function makeEnvelopeMarkers(c) {
    return [
        { freq: 2 * c.slipFreq, label: '2sf0 (BRB Mod)' },
        { freq: c.Nr / 60,      label: 'fr (Shaft Speed)' }
    ];
}

function renderKinematicsReport(c) {
    const html = `
      <table class="info-table">
        <tbody>
          <tr><td>Supply Frequency (f0)</td><td>${c.fundamentalFreq.toFixed(2)} Hz</td></tr>
          <tr><td>Synchronous Speed (Ns)</td><td>${c.syncSpeed.toFixed(1)} RPM</td></tr>
          <tr><td>Rotor Speed (Nr)</td><td>${c.rotorSpeedRpm.toFixed(1)} RPM (${c.rotorFreqHz.toFixed(2)} Hz)</td></tr>
          <tr><td>Calculated Slip (s)</td><td>${c.slipPercent.toFixed(2)}%</td></tr>
          <tr><td>Lower Rotor Bar Sideband (f0 - 2sf0)</td><td>${c.lowerSidebandFreq.toFixed(2)} Hz</td></tr>
          <tr><td>Upper Rotor Bar Sideband (f0 + 2sf0)</td><td>${c.upperSidebandFreq.toFixed(2)} Hz</td></tr>
          <tr><td>Airgap Eccentricity Sidebands (f0 ± fr)</td><td>${c.eccLowerFreq.toFixed(2)} Hz &amp; ${c.eccUpperFreq.toFixed(2)} Hz</td></tr>
        </tbody>
      </table>`;
    gv('kinematicsReport').innerHTML = html;
}

function renderQualityReport(q) {
    showSection('panel-quality', true);
    const badge = gv('qualityBadge');
    badge.className = `quality-badge ${q.overall}`;
    badge.textContent = `AUDIT RESULT: ${q.overall}`;

    let rows = q.checks.map(c => `
        <tr>
          <td>${c.label}</td>
          <td style="color:${c.status === 'PASS' ? 'var(--green)' : c.status === 'WARNING' ? 'var(--amber)' : 'var(--red)'}">${c.status}</td>
          <td>${c.message}</td>
        </tr>`).join('');

    gv('qualityReport').innerHTML = `<table class="info-table"><tbody>${rows}</tbody></table>`;
}

// ─── Comparison Mode ──────────────────────────────────────────────────────────

function tryRenderComparison() {
    const h = state.cmp.healthy.results;
    const f = state.cmp.faulty.results;

    if (!h.features || !f.features) return;

    showSection('panel-comp-features', true);
    renderComparisonDeltaTable(h.features, f.features);

    if (h.fft && f.fft) {
        showSection('panel-comp-fft', true);
        plotComparisonDualSpectrum('chart-comp-fft', h.fft, f.fft, 'FFT Spectral Overlay (dBFS)', false);
    }
    if (h.welch && f.welch) {
        showSection('panel-comp-welch', true);
        plotComparisonDualSpectrum('chart-comp-welch', h.welch, f.welch, 'Welch PSD Overlay (dB)', true);
    }
    if (h.hilbert && f.hilbert) {
        showSection('panel-comp-hilbert', true);
        plotComparisonDualSpectrum('chart-comp-hilbert', h.hilbert, f.hilbert, 'Hilbert Demodulated Envelope Overlay', false);
    }
}

function renderComparisonDeltaTable(h, f) {
    const dRms  = f.currentRms - h.currentRms;
    const dRmsPct = (dRms / h.currentRms) * 100;
    const dWorst = f.worst.dB - h.worst.dB;
    const dH5   = f.harmonics.h5.dB - h.harmonics.h5.dB;
    const dThd  = f.harmonics.thdPercent - h.harmonics.thdPercent;
    const dMod  = f.modulationIndex - h.modulationIndex;

    const deltaClass = (val) => val > 0 ? 'db-fault' : 'db-negative';

    const html = `
      <div class="feature-table-wrap">
        <table class="feature-table" aria-label="Comparison delta table">
          <thead><tr>
            <th>Telemetry Metric</th>
            <th>Baseline (Healthy)</th>
            <th>Target (Test File)</th>
            <th>Differential Delta (Δ)</th>
            <th>Diagnostic Interpretation</th>
          </tr></thead>
          <tbody>
            <tr>
              <td>Stator Current RMS</td>
              <td>${h.currentRms.toFixed(4)} A</td>
              <td>${f.currentRms.toFixed(4)} A</td>
              <td class="${deltaClass(dRms)}">${dRms > 0 ? '+' : ''}${dRms.toFixed(4)} A (${dRmsPct > 0 ? '+' : ''}${dRmsPct.toFixed(1)}%)</td>
              <td>${Math.abs(dRmsPct) > 15 ? 'Significant current elevation under fault drag' : 'Comparable operational current'}</td>
            </tr>
            <tr>
              <td>Worst Fault Sideband</td>
              <td>${h.worst.dB.toFixed(1)} dBFS</td>
              <td>${f.worst.dB.toFixed(1)} dBFS</td>
              <td class="${deltaClass(dWorst)}">${dWorst > 0 ? '+' : ''}${dWorst.toFixed(1)} dB</td>
              <td>${dWorst > 6 ? 'Severe sideband prominence increase' : 'Nominal sideband variation'}</td>
            </tr>
            <tr>
              <td>5th Harmonic (Flux Distortion)</td>
              <td>${h.harmonics.h5.dB.toFixed(1)} dBFS</td>
              <td>${f.harmonics.h5.dB.toFixed(1)} dBFS</td>
              <td class="${deltaClass(dH5)}">${dH5 > 0 ? '+' : ''}${dH5.toFixed(1)} dB</td>
              <td>${dH5 > 3 ? 'Elevated negative sequence core flux' : 'Normal flux symmetry'}</td>
            </tr>
            <tr>
              <td>Total Harmonic Distortion (THD)</td>
              <td>${h.harmonics.thdPercent.toFixed(2)}%</td>
              <td>${f.harmonics.thdPercent.toFixed(2)}%</td>
              <td class="${deltaClass(dThd)}">${dThd > 0 ? '+' : ''}${dThd.toFixed(2)}%</td>
              <td>${dThd > 5 ? 'High waveform distortion' : 'Within normal limits'}</td>
            </tr>
            <tr>
              <td>Hilbert Modulation Index</td>
              <td>${h.modulationIndex.toFixed(1)}%</td>
              <td>${f.modulationIndex.toFixed(1)}%</td>
              <td class="${deltaClass(dMod)}">${dMod > 0 ? '+' : ''}${dMod.toFixed(1)}%</td>
              <td>${dMod > 8 ? 'Significant mechanical torque modulation' : 'Normal envelope'}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
    gv('compFeatureTable').innerHTML = html;
}

function plotComparisonDualSpectrum(containerId, hSpec, fSpec, title, isPsd) {
    const N = Math.min(hSpec.freqs.length, fSpec.freqs.length);
    let step = Math.max(1, Math.floor(N / 3000));

    let hF = [], hY = [], fF = [], fY = [];
    let hFund = 1.0, fFund = 1.0;

    if (!isPsd) {
        let maxH = 0, maxF = 0;
        for (let i = 0; i < hSpec.mags.length; i++) if (hSpec.mags[i] > maxH) maxH = hSpec.mags[i];
        for (let i = 0; i < fSpec.mags.length; i++) if (fSpec.mags[i] > maxF) maxF = fSpec.mags[i];
        hFund = Math.max(maxH, 1e-12);
        fFund = Math.max(maxF, 1e-12);
    }

    for (let i = 0; i < N; i += step) {
        hF.push(hSpec.freqs[i]);
        fF.push(fSpec.freqs[i]);
        if (isPsd) {
            hY.push(10 * Math.log10(Math.max(hSpec.psd[i], 1e-15)));
            fY.push(10 * Math.log10(Math.max(fSpec.psd[i], 1e-15)));
        } else {
            hY.push(20 * Math.log10(Math.max(hSpec.mags[i], 1e-12) / hFund));
            fY.push(20 * Math.log10(Math.max(fSpec.mags[i], 1e-12) / fFund));
        }
    }

    const traces = [
        {
            x: hF, y: hY,
            type: 'scatter', mode: 'lines',
            line: { color: '#10b981', width: 1.2 },
            name: 'Baseline (Healthy)'
        },
        {
            x: fF, y: fY,
            type: 'scatter', mode: 'lines',
            line: { color: '#f43f5e', width: 1.2 },
            name: 'Target (Test File)'
        }
    ];

    const layout = {
        ...PLOTLY_DARK_LAYOUT,
        title: { text: title, font: { size: 12, color: '#f8fafc' }, x: 0.02 },
        xaxis: {
            ...PLOTLY_DARK_LAYOUT.xaxis,
            title: { text: 'Frequency (Hz)', font: { size: 10 } },
            range: [35, 65]
        },
        yaxis: {
            ...PLOTLY_DARK_LAYOUT.yaxis,
            title: { text: isPsd ? 'PSD (dB/Hz)' : 'Magnitude (dBFS)', font: { size: 10 } }
        }
    };

    Plotly.react(containerId, traces, layout, PLOTLY_CONFIG);
}

// ─── Execution Triggers ───────────────────────────────────────────────────────

function setProcessing(p) {
    state.isProcessing = p;
    gv('btnRun').disabled = p || !state.fileBuffer;
}

function showSection(id, show) {
    const el = gv(id);
    if (el) el.hidden = !show;
}

function showError(msg) {
    addWarning('err_' + Date.now(), msg, 'ERROR');
}

function switchTab(tabId) {
    document.querySelectorAll('.tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
        t.setAttribute('aria-selected', t.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.toggle('active', c.id === 'tab-' + tabId);
        c.hidden = (c.id !== 'tab-' + tabId);
    });
}

function runAnalysis(mode = 'single') {
    setProcessing(true);
    initProgress();
    seenWarnings.clear();
    gv('warningsArea').hidden = true;
    gv('warningsList').innerHTML = '';

    const params = collectParams();
    const worker = createWorker();

    if (mode === 'single') {
        const buf = state.fileBuffer.slice(0);
        worker.postMessage({
            type: 'ANALYZE',
            fileBuffer: buf,
            format: state.format,
            channelName: state.channelName,
            params,
            mode: 'single'
        }, [buf]);
    } else {
        const buf = state.cmp[mode].buffer.slice(0);
        const ch  = document.querySelector(`input[name="ch-${mode}"]:checked`)?.value || 'I1';
        worker.postMessage({
            type: 'ANALYZE',
            fileBuffer: buf,
            format: state.cmp[mode].format,
            channelName: ch,
            params,
            mode
        }, [buf]);
    }
}

function runDemo(demoMode = 'healthy') {
    setProcessing(true);
    initProgress();
    seenWarnings.clear();
    gv('warningsArea').hidden = true;
    gv('warningsList').innerHTML = '';
    const params = collectParams();
    params.demoMode = demoMode;
    const worker = createWorker();
    worker.postMessage({ type: 'GENERATE_DEMO', params });
}

function resetAll() {
    state.file = null;
    state.fileBuffer = null;
    state.format = null;
    state.results = {};
    gv('fileInput').value = '';
    gv('fileInfo').hidden = true;
    gv('channelPicker').hidden = true;
    gv('btnRun').disabled = true;
    gv('panel-progress').hidden = true;
    gv('panel-kpi').hidden = true;
    gv('panel-health').hidden = true;
    gv('panel-quality').hidden = true;
    gv('panel-raw').hidden = true;
    gv('panel-filtered').hidden = true;
    gv('panel-fft').hidden = true;
    gv('panel-welch').hidden = true;
    gv('panel-hilbert').hidden = true;
    gv('panel-kinematics').hidden = true;
    gv('panel-features').hidden = true;
    gv('panel-methods').hidden = true;
    gv('btnExport').disabled = true;
}

function exportAnalysis() {
    const report = {
        tool: 'Universal MCSA Diagnostic Analysis',
        exportedAt: new Date().toISOString(),
        filename: state.file?.name || 'synthetic_demo',
        parameters: collectParams(),
        verdict: state.results.verdict,
        features: state.results.features,
        motorCalcs: state.results.motorCalcs
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcsa-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Event Setup ──────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tab').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    setupDropZone('dropzone', 'fileInput', 'single');
    setupDropZone('dropzone-healthy', 'fileInput-healthy', 'healthy');
    setupDropZone('dropzone-faulty',  'fileInput-faulty',  'faulty');

    gv('btnRun')?.addEventListener('click', () => runAnalysis('single'));
    gv('btnDemoHealthy')?.addEventListener('click', () => runDemo('healthy'));
    gv('btnDemoFaulty')?.addEventListener('click', () => runDemo('faulty'));
    gv('btnResetFull')?.addEventListener('click', resetAll);
    gv('btnExport')?.addEventListener('click', exportAnalysis);

    gv('btnRunHealthy')?.addEventListener('click', () => runAnalysis('healthy'));
    gv('btnRunFaulty')?.addEventListener('click',  () => runAnalysis('faulty'));

    gv('btnZoomFFT')?.addEventListener('click', () => {
        const center = numVal('fftCenter', 50);
        const span   = numVal('fftSpan', 15);
        Plotly.relayout('chart-fft', { 'xaxis.range': [center - span, center + span] });
    });
    gv('btnResetFFT')?.addEventListener('click', () => {
        Plotly.relayout('chart-fft', { 'xaxis.autorange': true });
    });
    gv('btnZoomCompFFT')?.addEventListener('click', () => {
        const center = numVal('compFftCenter', 50);
        const span   = numVal('compFftSpan', 15);
        Plotly.relayout('chart-comp-fft', { 'xaxis.range': [center - span, center + span] });
    });
    gv('btnResetCompFFT')?.addEventListener('click', () => {
        Plotly.relayout('chart-comp-fft', { 'xaxis.autorange': true });
    });
});

function setupDropZone(dzId, inputId, mode) {
    const dz = gv(dzId);
    const fi = gv(inputId);
    if (!dz || !fi) return;

    dz.addEventListener('click', () => fi.click());
    dz.addEventListener('dragover',  (e) => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', (e) => {
        e.preventDefault();
        dz.classList.remove('drag-over');
        if (e.dataTransfer.files[0]) handleFileSelected(e.dataTransfer.files[0], mode);
    });
    fi.addEventListener('change', () => {
        if (fi.files[0]) handleFileSelected(fi.files[0], mode);
    });
}

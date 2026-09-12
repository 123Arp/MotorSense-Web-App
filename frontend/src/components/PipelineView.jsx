import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import FileUpload from './FileUpload';
import SpectrumChart, { MOTORSENSE_SCREEN_LAYOUT } from './SpectrumChart';
import VerdictBadge from './VerdictBadge';
import FeatureTable from './FeatureTable';
import ConditionGauge from './ConditionGauge';
import ReportModal from './ReportModal';
import api from '../api';

const VIEWS = [
  { id: 'spectrum', label: 'Spectrum (FFT)' },
  { id: 'oscilloscope', label: 'Time Trace' },
  { id: 'pipeline', label: '7-Stage Pipeline' },
];

export default function PipelineView({ params, updateParam }) {
  const [file, setFile] = useState(null);
  const [column, setColumn] = useState(params.column || 'I1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [view, setView] = useState('spectrum');

  const handleColumnsReady = (cols, fname, f, nSamples, sizeMb) => {
    setFile(f); setFileMeta({ name: fname, nSamples, sizeMb }); setError(null);
  };
  const handleColumnChange = (col) => { setColumn(col); updateParam('column', col); };

  const runWithFile = async (targetFile) => {
    if (!targetFile) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', targetFile);
      fd.append('params', JSON.stringify({ ...params, column, fs: Number(params.fs) }));
      const res = await api.post('/api/analyze', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Analysis error');
    } finally {
      setLoading(false);
    }
  };

  const handleSampleSelect = async (sampleId) => {
    setLoading(true); setError(null); setResult(null);
    setFileMeta({ name: sampleId, nSamples: 1000000, sizeMb: 72.0 });
    try {
      const fd = new FormData();
      fd.append('sample_id', sampleId);
      fd.append('params', JSON.stringify({ ...params, column, fs: Number(params.fs) }));
      const res = await api.post('/api/sample/analyze', fd);
      setResult(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Sample analysis error');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = () => {
    if (!result?.fft?.f) return;
    const rows = result.fft.f.map((f, i) => `${f},${result.fft.linear[i]}`).join('\n');
    const blob = new Blob([`Frequency_Hz,Magnitude_A\n${rows}`], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `MotorSense_Spectrum_${fileMeta?.name || 'data'}.csv`;
    a.click();
  };

  const sb = result?.sideband_info;
  const f0 = sb?.f_supply_hz;
  const sbLo = sb?.f_sb_lower_hz;
  const sbHi = sb?.f_sb_upper_hz;
  const thr = result?.threshold_dB ?? params.threshold_dB;
  const worstDb = result?.features?.worst_sideband_dB;
  const isHealthy = result?.verdict?.verdict === 'HEALTHY';

  const PlotWrap = ({ data, layout, height = 240 }) => (
    <div className="ms-plot-frame">
      <Plot
        data={data}
        layout={{ ...MOTORSENSE_SCREEN_LAYOUT, height, ...layout }}
        config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
        style={{ width: '100%' }}
        useResizeHandler
      />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Upload card */}
      <div className="ms-card">
        <div className="ms-card-header">
          <span className="ms-card-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
            </svg>
            Load Dataset
          </span>
          {fileMeta && (
            <span style={{ fontSize: '12px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
              {fileMeta.name} · {fileMeta.nSamples?.toLocaleString()} samples · {((fileMeta.nSamples || 0) / params.fs).toFixed(2)}s
            </span>
          )}
        </div>
        <div className="ms-card-body">
          <FileUpload
            onColumnsReady={handleColumnsReady}
            selectedColumn={column}
            onColumnChange={handleColumnChange}
            onSampleSelect={handleSampleSelect}
          />
          {file && (
            <button
              type="button"
              className="ms-btn ms-btn-primary"
              style={{ width: '100%', marginTop: '12px', height: '40px', fontSize: '14px', fontWeight: 600, justifyContent: 'center' }}
              onClick={() => runWithFile(file)}
              disabled={loading}
            >
              {loading
                ? <><div className="ms-spinner" style={{ width: '16px', height: '16px' }}/> Running MCSA Pipeline…</>
                : '▶  Run MCSA Analysis'}
            </button>
          )}
        </div>
      </div>

      {/* Errors / warnings */}
      {error && (
        <div className="ms-alert ms-alert-error">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}
      {result?.quality_check?.warnings?.map((w, i) => (
        <div key={i} className={`ms-alert ${w.severity === 'ERROR' ? 'ms-alert-error' : 'ms-alert-warn'}`}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          [{w.severity}] {w.message}
        </div>
      ))}

      {/* Loading */}
      {loading && !result && (
        <div className="ms-card">
          <div className="ms-loading-overlay">
            <div className="ms-spinner" style={{ width: '36px', height: '36px', borderWidth: '3px' }}/>
            <div className="ms-loading-text">Running 7-Stage MCSA Pipeline</div>
            <div className="ms-loading-sub">Applying Butterworth filter · Hanning window · FFT · Hilbert demodulation · Welch PSD</div>
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <>
          {/* Stats row */}
          <div className="ms-stats">
            {[
              { label: 'Carrier f₀', val: f0 != null ? f0.toFixed(2) : '—', unit: 'Hz' },
              { label: 'Lower SB', val: sbLo != null ? sbLo.toFixed(2) : '—', unit: 'Hz' },
              { label: 'Upper SB', val: sbHi != null ? sbHi.toFixed(2) : '—', unit: 'Hz' },
              { label: 'Worst SB', val: worstDb != null ? worstDb.toFixed(1) : '—', unit: 'dBFS' },
              { label: 'Threshold', val: thr != null ? thr : '—', unit: 'dBFS' },
            ].map(({ label, val, unit }) => (
              <div key={label} className="ms-stat-item">
                <div className="ms-stat-label">{label}</div>
                <div className="ms-stat-value">{val}<span className="ms-stat-unit">{unit}</span></div>
              </div>
            ))}
          </div>

          {/* Verdict + Gauge side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '12px', alignItems: 'center' }}>
            <div className="ms-card" style={{ padding: '14px 8px' }}>
              <ConditionGauge worstDb={worstDb} thresholdDb={thr} isHealthy={isHealthy}/>
            </div>
            <VerdictBadge verdict={result.verdict} thresholdDB={thr}/>
          </div>

          {/* Toolbar: view + actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div className="ms-view-tabs">
              {VIEWS.map((v) => (
                <button key={v.id} type="button"
                  className={`ms-view-tab ${view === v.id ? 'active' : ''}`}
                  onClick={() => setView(v.id)}
                >{v.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="ms-btn ms-btn-sm" onClick={exportCsv}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export CSV
              </button>
              <button type="button" className="ms-btn ms-btn-sm ms-btn-primary" onClick={() => setReportOpen(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                ISO 20958 Report
              </button>
            </div>
          </div>

          {/* VIEW: Spectrum */}
          {view === 'spectrum' && (
            <>
              <SpectrumChart
                title="Current Spectrum — dBFS (MCSA)"
                xFull={result.fft?.f} yFull={result.fft?.dB}
                xZoom={result.fft_zoom?.f} yZoom={result.fft_zoom?.dB}
                xLabel="Frequency (Hz)" yLabel="Relative Level (dBFS)"
                traceName={`Stator Current (${column})`}
                traceColor="#3b82f6"
                f_supply={f0} f_sb_lower={sbLo} f_sb_upper={sbHi}
                height={320}
              />
              <FeatureTable features={result.features} sidebandInfo={result.sideband_info} thresholdDB={thr}/>
            </>
          )}

          {/* VIEW: Oscilloscope */}
          {view === 'oscilloscope' && (
            <div className="ms-stage">
              <div className="ms-stage-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="ms-stage-num">~</div>
                  <span className="ms-stage-title">Stator Current — Time Domain (Channel {column})</span>
                </div>
                <span className="ms-stage-meta">{result.raw_signal?.display_window_ms} ms · {result.raw_signal?.total_samples?.toLocaleString()} pts</span>
              </div>
              <div className="ms-stage-body">
                <PlotWrap height={320}
                  data={[{ x: result.raw_signal?.t, y: result.raw_signal?.x, type: 'scatter', mode: 'lines', name: `CH ${column}`, line: { color: '#06b6d4', width: 1.5 } }]}
                  layout={{ xaxis: { ...MOTORSENSE_SCREEN_LAYOUT.xaxis, title: { text: 'Time (s)', font: { size: 11 } } }, yaxis: { ...MOTORSENSE_SCREEN_LAYOUT.yaxis, title: { text: 'Current (A)', font: { size: 11 } } } }}
                />
              </div>
            </div>
          )}

          {/* VIEW: 7-Stage pipeline */}
          {view === 'pipeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { num: '01', title: 'Raw Acquisition', meta: `${result.raw_signal?.display_window_ms} ms · ${result.raw_signal?.total_samples?.toLocaleString()} pts`, data: [{ x: result.raw_signal?.t, y: result.raw_signal?.x, type: 'scatter', mode: 'lines', name: 'Raw', line: { color: '#06b6d4', width: 1.3 } }], yLabel: 'Current (A)' },
                { num: '02', title: 'Resampled Signal', meta: `fs = ${params.fs?.toLocaleString()} Hz`, data: [{ x: result.resampled?.t, y: result.resampled?.x, type: 'scatter', mode: 'lines', name: 'Resampled', line: { color: '#60a5fa', width: 1.3 } }], yLabel: 'Current (A)' },
                { num: '03', title: 'Hanning Windowed', meta: 'w(n) = 0.5 – 0.5·cos(2πn/N)', data: [{ x: result.windowed?.t, y: result.windowed?.x, type: 'scatter', mode: 'lines', name: 'Windowed', line: { color: '#8b5cf6', width: 1.3 } }], yLabel: 'Current (A)' },
                { num: '04', title: 'Linear FFT Spectrum', meta: 'Amplitude spectrum', data: [{ x: result.fft?.f, y: result.fft?.linear, type: 'scatter', mode: 'lines', name: 'FFT Linear', line: { color: '#3b82f6', width: 1.3 } }], yLabel: 'Amplitude (Arms)', xLabel: 'Frequency (Hz)' },
                { num: '05', title: 'dBFS Zoom (Sideband Region)', meta: 'MCSA carrier + sidebands', data: [{ x: result.fft_zoom?.f, y: result.fft_zoom?.dB, type: 'scatter', mode: 'lines', name: 'dBFS Zoom', line: { color: '#f59e0b', width: 1.5 } }], yLabel: 'dBFS', xLabel: 'Frequency (Hz)' },
                { num: '06', title: 'Hilbert Envelope Spectrum', meta: 'A(t) = |x(t) + j·H{x(t)}|', data: [{ x: result.hilbert?.f, y: result.hilbert?.dB, type: 'scatter', mode: 'lines', name: 'Envelope', line: { color: '#22c55e', width: 1.3 } }], yLabel: 'Envelope dB', xLabel: 'Frequency (Hz)' },
                { num: '07', title: 'Welch PSD', meta: 'Hanning · 50% overlap', data: [{ x: result.psd?.f, y: result.psd?.psd, type: 'scatter', mode: 'lines', name: 'PSD', line: { color: '#eab308', width: 1.3 } }], yLabel: 'Power (A²/Hz)', xLabel: 'Frequency (Hz)' },
              ].map(({ num, title, meta, data, yLabel, xLabel }) => (
                <div key={num} className="ms-stage">
                  <div className="ms-stage-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="ms-stage-num">{num}</div>
                      <span className="ms-stage-title">{title}</span>
                    </div>
                    <span className="ms-stage-meta">{meta}</span>
                  </div>
                  <div className="ms-stage-body">
                    <PlotWrap height={200} data={data}
                      layout={{
                        xaxis: { ...MOTORSENSE_SCREEN_LAYOUT.xaxis, title: { text: xLabel || 'Time (s)', font: { size: 10 } } },
                        yaxis: { ...MOTORSENSE_SCREEN_LAYOUT.yaxis, title: { text: yLabel, font: { size: 10 } } },
                      }}
                    />
                  </div>
                </div>
              ))}
              <FeatureTable features={result.features} sidebandInfo={result.sideband_info} thresholdDB={thr}/>
            </div>
          )}
        </>
      )}

      <ReportModal isOpen={reportOpen} onClose={() => setReportOpen(false)} result={result} params={params} filename={fileMeta?.name}/>
    </div>
  );
}

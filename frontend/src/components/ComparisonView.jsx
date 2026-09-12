import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import FileUpload from './FileUpload';
import VerdictBadge from './VerdictBadge';
import { MOTORSENSE_SCREEN_LAYOUT } from './SpectrumChart';
import api from '../api';

function OverlayChart({ title, xH, yH, xF, yF, xLabel, yLabel, height = 280 }) {
  return (
    <div className="ms-card">
      <div className="ms-card-header">
        <span className="ms-card-title" style={{ fontSize: '12px' }}>{title}</span>
        <div className="ms-compare-legend">
          <div className="ms-legend-item"><span className="ms-legend-dot" style={{ background: '#22c55e' }}/> Healthy</div>
          <div className="ms-legend-item"><span className="ms-legend-dot" style={{ background: '#ef4444' }}/> Faulty</div>
        </div>
      </div>
      <div className="ms-plot-frame">
        <Plot
          data={[
            { x: xH || [], y: yH || [], type: 'scatter', mode: 'lines', name: 'Healthy', line: { color: '#22c55e', width: 1.5 } },
            { x: xF || [], y: yF || [], type: 'scatter', mode: 'lines', name: 'Faulty', line: { color: '#ef4444', width: 1.5 } },
          ]}
          layout={{
            ...MOTORSENSE_SCREEN_LAYOUT, height,
            xaxis: { ...MOTORSENSE_SCREEN_LAYOUT.xaxis, title: { text: xLabel || 'Frequency (Hz)', font: { size: 11 } } },
            yaxis: { ...MOTORSENSE_SCREEN_LAYOUT.yaxis, title: { text: yLabel || 'Amplitude', font: { size: 11 } } },
          }}
          config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
          style={{ width: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  );
}

function SideStat({ title, result }) {
  if (!result) return null;
  const isHealthy = result.verdict?.verdict === 'HEALTHY';
  return (
    <div style={{ background: isHealthy ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${isHealthy ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`, borderRadius: '8px', padding: '12px 14px' }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
      <div style={{ fontSize: '15px', fontWeight: 700, color: isHealthy ? 'var(--green)' : 'var(--red)' }}>{result.verdict?.verdict || '—'}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px', fontFamily: 'var(--font-mono)' }}>
        {result.filename} · {result.used_column}
      </div>
    </div>
  );
}

export default function ComparisonView({ params }) {
  const [healthyFile, setHealthyFile] = useState(null);
  const [faultyFile, setFaultyFile] = useState(null);
  const [healthyCol, setHealthyCol] = useState('I1');
  const [faultyCol, setFaultyCol] = useState('I1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  const runCompare = async () => {
    if (!healthyFile && !faultyFile) return;
    setLoading(true); setError(null); setResults(null);

    if (healthyFile && faultyFile) {
      const fd = new FormData();
      fd.append('healthy_file', healthyFile);
      fd.append('faulty_file', faultyFile);
      fd.append('params', JSON.stringify({ ...params, healthy_column: healthyCol, faulty_column: faultyCol, fs: Number(params.fs) }));
      try {
        const res = await api.post('/api/compare', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        setResults(res.data);
      } catch (err) {
        setError(err?.response?.data?.detail || err.message || 'Comparison error');
      } finally { setLoading(false); }
    } else {
      // One file: run sample presets
      const fd = new FormData();
      fd.append('sample_id', 'FILE 1.mat');
      fd.append('params', JSON.stringify({ ...params, fs: Number(params.fs) }));
      try {
        const [h, f] = await Promise.all([
          api.post('/api/sample/analyze', (() => { const d = new FormData(); d.append('sample_id', 'FILE 1.mat'); d.append('params', JSON.stringify({ ...params, fs: Number(params.fs) })); return d; })()),
          api.post('/api/sample/analyze', (() => { const d = new FormData(); d.append('sample_id', 'FILE 6.mat'); d.append('params', JSON.stringify({ ...params, fs: Number(params.fs) })); return d; })()),
        ]);
        setResults({ healthy: h.data, faulty: f.data });
      } catch (err) {
        setError(err?.response?.data?.detail || err.message || 'Comparison error');
      } finally { setLoading(false); }
    }
  };

  const h = results?.healthy;
  const f = results?.faulty;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Upload panels */}
      <div className="ms-compare-cols">
        {[
          { label: 'Healthy Motor', color: 'var(--green)', file: healthyFile, setFile: setHealthyFile, col: healthyCol, setCol: setHealthyCol },
          { label: 'Faulty Motor', color: 'var(--red)', file: faultyFile, setFile: setFaultyFile, col: faultyCol, setCol: setFaultyCol },
        ].map(({ label, color, file, setFile, col, setCol }) => (
          <div key={label} className="ms-card">
            <div className="ms-card-header">
              <span className="ms-card-title">
                <span style={{ color, fontWeight: 700, fontSize: '15px', lineHeight: 1 }}>●</span>
                {label}
              </span>
            </div>
            <div className="ms-card-body">
              <FileUpload
                onColumnsReady={(_, fname, fi) => setFile(fi)}
                selectedColumn={col}
                onColumnChange={setCol}
                onSampleSelect={() => {}}
              />
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button
          type="button"
          className="ms-btn ms-btn-primary"
          style={{ flex: 1, height: '40px', fontSize: '14px', fontWeight: 600, justifyContent: 'center' }}
          onClick={runCompare}
          disabled={loading}
        >
          {loading ? <><div className="ms-spinner" style={{ width: '16px', height: '16px' }}/> Comparing…</> : '▶  Run Comparison'}
        </button>
        <button
          type="button"
          className="ms-btn ms-btn-sm"
          style={{ height: '40px', whiteSpace: 'nowrap' }}
          onClick={() => {
            setHealthyFile(null); setFaultyFile(null);
            runCompare();
          }}
        >
          ⚡ Use Demo Files (FILE 1 vs FILE 6)
        </button>
      </div>

      {error && (
        <div className="ms-alert ms-alert-error">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}

      {loading && !results && (
        <div className="ms-card">
          <div className="ms-loading-overlay">
            <div className="ms-spinner" style={{ width: '36px', height: '36px', borderWidth: '3px' }}/>
            <div className="ms-loading-text">Running MCSA Pipeline on Both Files</div>
            <div className="ms-loading-sub">This may take 30–60 seconds for large datasets.</div>
          </div>
        </div>
      )}

      {results && (
        <>
          {/* Verdict side-by-side */}
          <div className="ms-compare-cols">
            <SideStat title="Healthy Motor" result={h}/>
            <SideStat title="Evaluated Motor" result={f}/>
          </div>

          {/* Overlay charts */}
          <OverlayChart title="Current Spectrum Overlay — Linear Amplitude" xH={h?.fft?.f} yH={h?.fft?.linear} xF={f?.fft?.f} yF={f?.fft?.linear} yLabel="Amplitude (Arms)" xLabel="Frequency (Hz)"/>
          <OverlayChart title="Current Spectrum Overlay — dBFS" xH={h?.fft?.f} yH={h?.fft?.dB} xF={f?.fft?.f} yF={f?.fft?.dB} yLabel="Level (dBFS)" xLabel="Frequency (Hz)"/>
          <OverlayChart title="Sideband Zoom — dBFS" xH={h?.fft_zoom?.f} yH={h?.fft_zoom?.dB} xF={f?.fft_zoom?.f} yF={f?.fft_zoom?.dB} yLabel="Level (dBFS)" xLabel="Frequency (Hz)"/>

          {/* Delta table */}
          {h?.features && f?.features && (
            <div className="ms-card">
              <div className="ms-card-header">
                <span className="ms-card-title">Feature Delta (Faulty − Healthy)</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="ms-ftable">
                  <thead>
                    <tr><th>Feature</th><th>Healthy</th><th>Faulty</th><th>Δ</th></tr>
                  </thead>
                  <tbody>
                    {[
                      ['Worst Sideband (dBFS)', 'worst_sideband_dB', 1],
                      ['Lower SB (dBFS)', 'lower_sb_dBFS', 1],
                      ['Upper SB (dBFS)', 'upper_sb_dBFS', 1],
                      ['RMS Current (A)', 'rms_current', 4],
                      ['THD', 'thd', 5],
                      ['Kurtosis', 'kurtosis', 3],
                    ].map(([label, key, dp]) => {
                      const hv = h.features[key]; const fv = f.features[key];
                      const delta = hv != null && fv != null ? fv - hv : null;
                      return (
                        <tr key={key}>
                          <td style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-2)' }}>{label}</td>
                          <td>{hv != null ? hv.toFixed(dp) : '—'}</td>
                          <td>{fv != null ? fv.toFixed(dp) : '—'}</td>
                          <td style={{ color: delta == null ? 'var(--text-3)' : delta > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
                            {delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(dp)}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import FileUpload from './FileUpload';
import VerdictBadge from './VerdictBadge';
import { BASE_LAYOUT } from './SpectrumChart';
import api from '../api';

function OverlayPlot({ title, xH, yH, xF, yF, xLabel, yLabel, f0, sbLo, sbHi, height = 260 }) {
  const shapes = [];
  if (f0) {
    shapes.push({
      type: 'line', x0: f0, x1: f0, yref: 'paper', y0: 0, y1: 1,
      line: { color: '#1A56DB', width: 1.5, dash: 'solid' },
    });
  }
  if (sbLo) {
    shapes.push({
      type: 'line', x0: sbLo, x1: sbLo, yref: 'paper', y0: 0, y1: 1,
      line: { color: '#C81E1E', width: 1.5, dash: 'dot' },
    });
  }
  if (sbHi) {
    shapes.push({
      type: 'line', x0: sbHi, x1: sbHi, yref: 'paper', y0: 0, y1: 1,
      line: { color: '#C81E1E', width: 1.5, dash: 'dot' },
    });
  }

  const layout = {
    ...BASE_LAYOUT,
    height,
    shapes,
    xaxis: { ...BASE_LAYOUT.xaxis, title: { text: xLabel || 'Frequency (Hz)', font: { size: 11 } } },
    yaxis: { ...BASE_LAYOUT.yaxis, title: { text: yLabel || 'Amplitude', font: { size: 11 } } },
  };

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="card-header">
        <div className="stage-title">{title}</div>
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#057A55' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#057A55', display: 'inline-block' }} /> Healthy
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#C81E1E' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#C81E1E', display: 'inline-block' }} /> Faulty
          </span>
        </div>
      </div>
      <div className="card-body">
        <Plot
          data={[
            {
              x: xH || [],
              y: yH || [],
              type: 'scatter',
              mode: 'lines',
              name: 'Healthy Reference',
              line: { color: '#057A55', width: 1.5 },
            },
            {
              x: xF || [],
              y: yF || [],
              type: 'scatter',
              mode: 'lines',
              name: 'Faulty Machine',
              line: { color: '#C81E1E', width: 1.5 },
            },
          ]}
          layout={layout}
          config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
          style={{ width: '100%' }}
          useResizeHandler
        />
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

  const runComparison = async () => {
    if (!healthyFile || !faultyFile) return;
    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const fd = new FormData();
      fd.append('healthy_file', healthyFile);
      fd.append('faulty_file', faultyFile);
      fd.append(
        'params',
        JSON.stringify({
          ...params,
          fs: Number(params.fs),
          healthy_column: healthyCol,
          faulty_column: faultyCol,
        })
      );

      const res = await api.post('/api/compare', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResults(res.data);
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Comparison failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const H = results?.healthy;
  const F = results?.faulty;
  const f0 = H?.sideband_info?.f_supply_hz;
  const sbLo = H?.sideband_info?.f_sb_lower_hz;
  const sbHi = H?.sideband_info?.f_sb_upper_hz;
  const thr = params.threshold_dB ?? -40;

  const deltaLower = F && H ? F.features?.L_lower_dB - H.features?.L_lower_dB : null;
  const deltaUpper = F && H ? F.features?.L_upper_dB - H.features?.L_upper_dB : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Upload Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              1. Baseline Healthy Recording
            </div>
          </div>
          <div className="card-body">
            <FileUpload
              label=""
              accent="#057A55"
              onColumnsReady={(_cols, _fname, f) => setHealthyFile(f)}
              selectedColumn={healthyCol}
              onColumnChange={setHealthyCol}
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              2. Suspect Faulty Recording
            </div>
          </div>
          <div className="card-body">
            <FileUpload
              label=""
              accent="#C81E1E"
              onColumnsReady={(_cols, _fname, f) => setFaultyFile(f)}
              selectedColumn={faultyCol}
              onColumnChange={setFaultyCol}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn-primary"
        style={{ width: '100%', justifyContent: 'center', padding: '10px', fontSize: '13px' }}
        disabled={loading || !healthyFile || !faultyFile}
        onClick={runComparison}
      >
        {loading ? (
          <>
            <div className="spinner" />
            Computing Comparative DSP Pipeline across both files...
          </>
        ) : (
          '⚖ Run Comparative Spectral & Feature Analysis'
        )}
      </button>

      {error && (
        <div className="banner banner-error">
          <span>⚠</span>
          <div><strong>Error:</strong> {error}</div>
        </div>
      )}

      {results && (
        <>
          {/* Dual Verdicts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#057A55', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                Baseline ({H?.filename}):
              </div>
              <VerdictBadge verdict={H?.verdict} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#C81E1E', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
                Evaluated Machine ({F?.filename}):
              </div>
              <VerdictBadge verdict={F?.verdict} />
            </div>
          </div>

          {/* Delta Table */}
          <div className="card">
            <div className="card-header">
              <div className="stage-title">Comparative Sideband Level Metric (Δ dB)</div>
              <div className="stage-sub">
                Evaluated Faulty (dB) − Baseline Healthy (dB) · Positive Δ indicates spectral fault energy amplification
              </div>
            </div>
            <div className="card-body">
              <table className="feature-table">
                <thead>
                  <tr>
                    <th>Spectral Feature</th>
                    <th>Baseline Healthy (dB)</th>
                    <th>Evaluated Faulty (dB)</th>
                    <th>Δ Difference (dB)</th>
                    <th>Fault Threshold</th>
                    <th>Diagnostic Assessment</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Lower Sideband (SB-)</td>
                    <td className="mono-val" style={{ color: '#057A55', fontWeight: 700 }}>{H?.features?.L_lower_dB?.toFixed(2)} dB</td>
                    <td className="mono-val" style={{ color: '#111928', fontWeight: 700 }}>{F?.features?.L_lower_dB?.toFixed(2)} dB</td>
                    <td className="mono-val" style={{ fontWeight: 800, fontSize: '13px', color: (deltaLower || 0) > 0 ? '#C81E1E' : '#057A55' }}>
                      {(deltaLower || 0) > 0 ? `+${deltaLower?.toFixed(2)}` : deltaLower?.toFixed(2)} dB
                    </td>
                    <td className="mono-val" style={{ color: '#6B7280' }}>{thr} dB</td>
                    <td>
                      <span style={{
                        fontSize: '10px', padding: '2px 6px', borderRadius: '3px', fontWeight: 700, textTransform: 'uppercase',
                        background: (F?.features?.L_lower_dB || 0) > thr ? '#FDE8E8' : '#E3FBF2',
                        color: (F?.features?.L_lower_dB || 0) > thr ? '#C81E1E' : '#057A55',
                      }}>
                        {(F?.features?.L_lower_dB || 0) > thr ? 'FAULT ENERGY DETECTED' : 'WITHIN NORMAL LIMITS'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Upper Sideband (SB+)</td>
                    <td className="mono-val" style={{ color: '#057A55', fontWeight: 700 }}>{H?.features?.L_upper_dB?.toFixed(2)} dB</td>
                    <td className="mono-val" style={{ color: '#111928', fontWeight: 700 }}>{F?.features?.L_upper_dB?.toFixed(2)} dB</td>
                    <td className="mono-val" style={{ fontWeight: 800, fontSize: '13px', color: (deltaUpper || 0) > 0 ? '#C81E1E' : '#057A55' }}>
                      {(deltaUpper || 0) > 0 ? `+${deltaUpper?.toFixed(2)}` : deltaUpper?.toFixed(2)} dB
                    </td>
                    <td className="mono-val" style={{ color: '#6B7280' }}>{thr} dB</td>
                    <td>
                      <span style={{
                        fontSize: '10px', padding: '2px 6px', borderRadius: '3px', fontWeight: 700, textTransform: 'uppercase',
                        background: (F?.features?.L_upper_dB || 0) > thr ? '#FDE8E8' : '#E3FBF2',
                        color: (F?.features?.L_upper_dB || 0) > thr ? '#C81E1E' : '#057A55',
                      }}>
                        {(F?.features?.L_upper_dB || 0) > thr ? 'FAULT ENERGY DETECTED' : 'WITHIN NORMAL LIMITS'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Overlaid Spectral Charts */}
          <OverlayPlot
            title="Method 1: FFT Amplitude Spectrum Overlay (Carrier ±50 Hz Zoom)"
            xH={H?.fft?.freqs_zoom}
            yH={H?.fft?.mag_zoom}
            xF={F?.fft?.freqs_zoom}
            yF={F?.fft?.mag_zoom}
            xLabel="Frequency (Hz)"
            yLabel="Amplitude (A)"
            f0={f0}
            sbLo={sbLo}
            sbHi={sbHi}
          />

          <OverlayPlot
            title="Method 2: Welch PSD Estimate Overlay (Averaged Variance Reduction)"
            xH={H?.welch_psd?.freqs_zoom}
            yH={H?.welch_psd?.psd_db_zoom}
            xF={F?.welch_psd?.freqs_zoom}
            yF={F?.welch_psd?.psd_db_zoom}
            xLabel="Frequency (Hz)"
            yLabel="PSD (dB/Hz)"
            f0={f0}
            sbLo={sbLo}
            sbHi={sbHi}
          />

          <OverlayPlot
            title="Method 3: Hilbert Envelope Spectrum Overlay (Demodulated Modulation)"
            xH={H?.hilbert_envelope?.freqs_zoom}
            yH={H?.hilbert_envelope?.mag_zoom}
            xF={F?.hilbert_envelope?.freqs_zoom}
            yF={F?.hilbert_envelope?.mag_zoom}
            xLabel="Modulation Frequency (Hz)"
            yLabel="Envelope Magnitude"
            f0={f0}
            sbLo={sbLo}
            sbHi={sbHi}
          />
        </>
      )}
    </div>
  );
}

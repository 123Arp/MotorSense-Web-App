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
      line: { color: '#0F4C81', width: 1.5, dash: 'solid' },
    });
  }
  if (sbLo) {
    shapes.push({
      type: 'line', x0: sbLo, x1: sbLo, yref: 'paper', y0: 0, y1: 1,
      line: { color: '#B91C1C', width: 1.5, dash: 'dot' },
    });
  }
  if (sbHi) {
    shapes.push({
      type: 'line', x0: sbHi, x1: sbHi, yref: 'paper', y0: 0, y1: 1,
      line: { color: '#B91C1C', width: 1.5, dash: 'dot' },
    });
  }

  const layout = {
    ...BASE_LAYOUT,
    height,
    shapes,
    xaxis: { ...BASE_LAYOUT.xaxis, title: { text: xLabel || 'Frequency (Hz)', font: { size: 11, color: '#475569' } } },
    yaxis: { ...BASE_LAYOUT.yaxis, title: { text: yLabel || 'Amplitude', font: { size: 11, color: '#475569' } } },
  };

  return (
    <div className="inst-panel">
      <div className="inst-panel-header">
        <div className="stage-title-text" style={{ fontFamily: 'monospace' }}>{title}</div>
        <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '14px', fontFamily: 'monospace' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#15803D' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '1px', background: '#15803D', display: 'inline-block' }} /> TRACE A: BASELINE (HEALTHY)
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#B91C1C' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '1px', background: '#B91C1C', display: 'inline-block' }} /> TRACE B: EVALUATED (FAULTY)
          </span>
        </div>
      </div>
      <div className="inst-panel-body">
        <Plot
          data={[
            {
              x: xH || [],
              y: yH || [],
              type: 'scatter',
              mode: 'lines',
              name: 'Trace A (Healthy)',
              line: { color: '#15803D', width: 1.5 },
            },
            {
              x: xF || [],
              y: yF || [],
              type: 'scatter',
              mode: 'lines',
              name: 'Trace B (Suspect)',
              line: { color: '#B91C1C', width: 1.5 },
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
      const msg = err?.response?.data?.detail || err.message || 'Comparison execution failed';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Upload Panels Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
        <div className="inst-panel" style={{ marginBottom: 0 }}>
          <div className="inst-panel-header" style={{ background: '#F0FDF4', borderColor: '#BBF7D0' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803D', fontFamily: 'monospace' }}>
              [CHANNEL A] BENCHMARK BASELINE RECORDING (HEALTHY)
            </span>
          </div>
          <div className="inst-panel-body">
            <FileUpload
              label=""
              onColumnsReady={(_cols, _fname, f) => setHealthyFile(f)}
              selectedColumn={healthyCol}
              onColumnChange={setHealthyCol}
            />
          </div>
        </div>

        <div className="inst-panel" style={{ marginBottom: 0 }}>
          <div className="inst-panel-header" style={{ background: '#FEF2F2', borderColor: '#FECACA' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#B91C1C', fontFamily: 'monospace' }}>
              [CHANNEL B] EVALUATED RECORDING (SUSPECT ANOMALY)
            </span>
          </div>
          <div className="inst-panel-body">
            <FileUpload
              label=""
              onColumnsReady={(_cols, _fname, f) => setFaultyFile(f)}
              selectedColumn={faultyCol}
              onColumnChange={setFaultyCol}
            />
          </div>
        </div>
      </div>

      <button
        type="button"
        className="btn-inst-primary"
        style={{ width: '100%', height: '36px', fontSize: '13px' }}
        disabled={loading || !healthyFile || !faultyFile}
        onClick={runComparison}
      >
        {loading ? (
          <>
            <div className="inst-spinner" />
            COMPUTING DUAL-TRACE OVERLAID SPECTRAL TRANSFORMS...
          </>
        ) : (
          'EXECUTE COMPARATIVE BENCHMARK ANALYSIS (TRACE A vs TRACE B)'
        )}
      </button>

      {error && (
        <div className="inst-banner inst-banner-alert">
          <div><strong>Comparative Analysis Error:</strong> {error}</div>
        </div>
      )}

      {results && (
        <>
          {/* Dual Status Assessment */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#15803D', fontFamily: 'monospace', marginBottom: '4px' }}>
                BASELINE STATUS [{H?.filename}]:
              </div>
              <VerdictBadge verdict={H?.verdict} thresholdDB={thr} />
            </div>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#B91C1C', fontFamily: 'monospace', marginBottom: '4px' }}>
                EVALUATED STATUS [{F?.filename}]:
              </div>
              <VerdictBadge verdict={F?.verdict} thresholdDB={thr} />
            </div>
          </div>

          {/* Differential Feature Table */}
          <div className="inst-panel">
            <div className="inst-panel-header">
              <span className="stage-title-text">DIFFERENTIAL SPECTRAL ENERGY MATRIX (Δ dBFS)</span>
              <span className="stage-meta-text">FORMULA: Δ = LEVEL_EVALUATED − LEVEL_BASELINE</span>
            </div>
            <div className="inst-panel-body">
              <table className="inst-table">
                <thead>
                  <tr>
                    <th>Spectral Coordinate</th>
                    <th>Baseline Healthy (dBFS)</th>
                    <th>Evaluated Machine (dBFS)</th>
                    <th>Δ Energy Difference</th>
                    <th>ISO Decision Threshold</th>
                    <th>Differential Assessment</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Lower Pole-Pass (f₀ − 2sf₀)</td>
                    <td className="font-mono" style={{ color: '#15803D', fontWeight: 700 }}>{H?.features?.L_lower_dB?.toFixed(2)} dBFS</td>
                    <td className="font-mono" style={{ color: '#0F172A', fontWeight: 700 }}>{F?.features?.L_lower_dB?.toFixed(2)} dBFS</td>
                    <td className="font-mono" style={{ fontWeight: 800, fontSize: '13px', color: (deltaLower || 0) > 0 ? '#B91C1C' : '#15803D' }}>
                      {(deltaLower || 0) > 0 ? `+${deltaLower?.toFixed(2)}` : deltaLower?.toFixed(2)} dB
                    </td>
                    <td className="font-mono" style={{ color: '#64748B' }}>{thr} dBFS</td>
                    <td>
                      <span style={{
                        fontSize: '10px', padding: '2px 6px', borderRadius: '2px', fontWeight: 700, fontFamily: 'monospace',
                        background: (F?.features?.L_lower_dB || 0) > thr ? '#FEE2E2' : '#DCFCE7',
                        color: (F?.features?.L_lower_dB || 0) > thr ? '#B91C1C' : '#15803D',
                        border: `1px solid ${(F?.features?.L_lower_dB || 0) > thr ? '#FCA5A5' : '#86EFAC'}`
                      }}>
                        {(F?.features?.L_lower_dB || 0) > thr ? 'ALARM: ELEVATED FLUX MODULATION' : 'NORMAL: SYMMETRIC FLUX'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Upper Pole-Pass (f₀ + 2sf₀)</td>
                    <td className="font-mono" style={{ color: '#15803D', fontWeight: 700 }}>{H?.features?.L_upper_dB?.toFixed(2)} dBFS</td>
                    <td className="font-mono" style={{ color: '#0F172A', fontWeight: 700 }}>{F?.features?.L_upper_dB?.toFixed(2)} dBFS</td>
                    <td className="font-mono" style={{ fontWeight: 800, fontSize: '13px', color: (deltaUpper || 0) > 0 ? '#B91C1C' : '#15803D' }}>
                      {(deltaUpper || 0) > 0 ? `+${deltaUpper?.toFixed(2)}` : deltaUpper?.toFixed(2)} dB
                    </td>
                    <td className="font-mono" style={{ color: '#64748B' }}>{thr} dBFS</td>
                    <td>
                      <span style={{
                        fontSize: '10px', padding: '2px 6px', borderRadius: '2px', fontWeight: 700, fontFamily: 'monospace',
                        background: (F?.features?.L_upper_dB || 0) > thr ? '#FEE2E2' : '#DCFCE7',
                        color: (F?.features?.L_upper_dB || 0) > thr ? '#B91C1C' : '#15803D',
                        border: `1px solid ${(F?.features?.L_upper_dB || 0) > thr ? '#FCA5A5' : '#86EFAC'}`
                      }}>
                        {(F?.features?.L_upper_dB || 0) > thr ? 'ALARM: ELEVATED FLUX MODULATION' : 'NORMAL: SYMMETRIC FLUX'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Dual-Trace Overlaid Spectral Charts */}
          <OverlayPlot
            title="DUAL-TRACE METHOD 1: FFT AMPLITUDE SPECTRUM (CARRIER ±50 Hz SPAN)"
            xH={H?.fft?.freqs_zoom}
            yH={H?.fft?.mag_zoom}
            xF={F?.fft?.freqs_zoom}
            yF={F?.fft?.mag_zoom}
            xLabel="Frequency (Hz)"
            yLabel="Amplitude (Arms)"
            f0={f0}
            sbLo={sbLo}
            sbHi={sbHi}
          />

          <OverlayPlot
            title="DUAL-TRACE METHOD 2: WELCH POWER SPECTRAL DENSITY (PSD ESTIMATE)"
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
            title="DUAL-TRACE METHOD 3: HILBERT DEMODULATED ENVELOPE MODULATION"
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

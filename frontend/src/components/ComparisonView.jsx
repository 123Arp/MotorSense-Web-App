import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import FileUpload from './FileUpload';
import VerdictBadge from './VerdictBadge';
import { ALICE_SCREEN_LAYOUT } from './SpectrumChart';
import api from '../api';

function OverlayPlot({ title, xH, yH, xF, yF, xLabel, yLabel, f0, sbLo, sbHi, height = 240 }) {
  const shapes = [];
  if (f0) {
    shapes.push({
      type: 'line', x0: f0, x1: f0, yref: 'paper', y0: 0, y1: 1,
      line: { color: '#2979FF', width: 1.5, dash: 'solid' },
    });
  }
  if (sbLo) {
    shapes.push({
      type: 'line', x0: sbLo, x1: sbLo, yref: 'paper', y0: 0, y1: 1,
      line: { color: '#FF1744', width: 1.5, dash: 'dot' },
    });
  }
  if (sbHi) {
    shapes.push({
      type: 'line', x0: sbHi, x1: sbHi, yref: 'paper', y0: 0, y1: 1,
      line: { color: '#FF1744', width: 1.5, dash: 'dot' },
    });
  }

  const layout = {
    ...ALICE_SCREEN_LAYOUT,
    height,
    shapes,
    xaxis: { ...ALICE_SCREEN_LAYOUT.xaxis, title: { text: xLabel || 'Frequency (Hz)', font: { size: 10, color: '#90CAF9' } } },
    yaxis: { ...ALICE_SCREEN_LAYOUT.yaxis, title: { text: yLabel || 'Amplitude', font: { size: 10, color: '#90CAF9' } } },
  };

  return (
    <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '3px', padding: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', padding: '0 4px' }}>
        <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#64B5F6' }}>
          {title}
        </span>
        <div style={{ display: 'flex', gap: '12px', fontSize: '10px', fontFamily: 'monospace' }}>
          <span style={{ color: '#00E676', fontWeight: 700 }}>■ TRACE A: HEALTHY REF</span>
          <span style={{ color: '#FF1744', fontWeight: 700 }}>■ TRACE B: EVALUATED</span>
        </div>
      </div>
      <Plot
        data={[
          {
            x: xH || [],
            y: yH || [],
            type: 'scatter',
            mode: 'lines',
            name: 'Trace A (Healthy)',
            line: { color: '#00E676', width: 1.5 },
          },
          {
            x: xF || [],
            y: yF || [],
            type: 'scatter',
            mode: 'lines',
            name: 'Trace B (Suspect)',
            line: { color: '#FF1744', width: 1.5 },
          },
        ]}
        layout={layout}
        config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
        style={{ width: '100%' }}
        useResizeHandler
      />
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
      const msg = err?.response?.data?.detail || err.message || 'Comparison error';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* Dual Channel File Ingestion Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '8px' }}>
        <div style={{ background: '#0F1523', border: '1px solid #1E3A2B', borderRadius: '3px', padding: '6px' }}>
          <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#00E676', marginBottom: '4px' }}>
            [CHANNEL A] BASELINE RECORDING (HEALTHY)
          </div>
          <FileUpload
            label=""
            onColumnsReady={(_cols, _fname, f) => setHealthyFile(f)}
            selectedColumn={healthyCol}
            onColumnChange={setHealthyCol}
          />
        </div>

        <div style={{ background: '#0F1523', border: '1px solid #3E1B24', borderRadius: '3px', padding: '6px' }}>
          <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#FF1744', marginBottom: '4px' }}>
            [CHANNEL B] EVALUATED RECORDING (SUSPECT ANOMALY)
          </div>
          <FileUpload
            label=""
            onColumnsReady={(_cols, _fname, f) => setFaultyFile(f)}
            selectedColumn={faultyCol}
            onColumnChange={setFaultyCol}
          />
        </div>
      </div>

      <button
        type="button"
        className="btn-m1k btn-m1k-run"
        style={{ width: '100%', height: '32px', fontSize: '12px' }}
        disabled={loading || !healthyFile || !faultyFile}
        onClick={runComparison}
      >
        {loading ? (
          <>
            <div className="inst-spinner" style={{ borderTopColor: '#FFFFFF' }} />
            PROCESSING DUAL-TRACE OVERLAY TRANSFORMS...
          </>
        ) : (
          '▶ RUN DUAL-CHANNEL COMPARATIVE ANALYSIS (TRACE A vs TRACE B)'
        )}
      </button>

      {error && (
        <div style={{ background: '#3D0A14', border: '1px solid #FF1744', color: '#FF8A80', padding: '8px', borderRadius: '2px', fontSize: '11px', fontFamily: 'monospace' }}>
          ERROR: {error}
        </div>
      )}

      {results && (
        <>
          {/* Dual Verdict Readout */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#00E676', marginBottom: '2px' }}>
                TRACE A (HEALTHY) STATUS:
              </div>
              <VerdictBadge verdict={H?.verdict} thresholdDB={thr} />
            </div>
            <div>
              <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#FF1744', marginBottom: '2px' }}>
                TRACE B (EVALUATED) STATUS:
              </div>
              <VerdictBadge verdict={F?.verdict} thresholdDB={thr} />
            </div>
          </div>

          {/* Differential Delta Table */}
          <div style={{ background: '#090D16', border: '1px solid #1F2C42', borderRadius: '2px', padding: '6px' }}>
            <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#64B5F6', marginBottom: '4px' }}>
              DIFFERENTIAL SPECTRAL ENERGY MATRIX (Δ dBFS = TRACE B − TRACE A)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'monospace' }}>
              <thead>
                <tr style={{ background: '#101726', color: '#90CAF9', borderBottom: '1px solid #23314A' }}>
                  <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px' }}>COORDINATE</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px' }}>TRACE A (HEALTHY)</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px' }}>TRACE B (EVALUATED)</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px' }}>Δ ENERGY RATIO</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px' }}>THRESHOLD</th>
                  <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px' }}>EVALUATION</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid #172236' }}>
                  <td style={{ padding: '4px 6px', color: '#E0E6ED' }}>Lower Pole-Pass (f₀ − 2sf₀)</td>
                  <td style={{ padding: '4px 6px', color: '#00E676', fontWeight: 700 }}>{H?.features?.L_lower_dB?.toFixed(2)} dBFS</td>
                  <td style={{ padding: '4px 6px', color: '#00E5FF', fontWeight: 700 }}>{F?.features?.L_lower_dB?.toFixed(2)} dBFS</td>
                  <td style={{ padding: '4px 6px', fontWeight: 800, color: (deltaLower || 0) > 0 ? '#FF1744' : '#00E676' }}>
                    {(deltaLower || 0) > 0 ? `+${deltaLower?.toFixed(2)}` : deltaLower?.toFixed(2)} dB
                  </td>
                  <td style={{ padding: '4px 6px', color: '#64748B' }}>{thr} dBFS</td>
                  <td style={{ padding: '4px 6px' }}>
                    <span style={{
                      fontSize: '9px', padding: '1px 5px', borderRadius: '2px', fontWeight: 700,
                      background: (F?.features?.L_lower_dB || 0) > thr ? '#4D0A14' : '#0A3B22',
                      color: (F?.features?.L_lower_dB || 0) > thr ? '#FF5252' : '#69F0AE',
                      border: `1px solid ${(F?.features?.L_lower_dB || 0) > thr ? '#FF1744' : '#00E676'}`
                    }}>
                      {(F?.features?.L_lower_dB || 0) > thr ? 'ALARM: ELEVATED FLUX' : 'NORMAL: SYMMETRIC FLUX'}
                    </span>
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid #172236' }}>
                  <td style={{ padding: '4px 6px', color: '#E0E6ED' }}>Upper Pole-Pass (f₀ + 2sf₀)</td>
                  <td style={{ padding: '4px 6px', color: '#00E676', fontWeight: 700 }}>{H?.features?.L_upper_dB?.toFixed(2)} dBFS</td>
                  <td style={{ padding: '4px 6px', color: '#00E5FF', fontWeight: 700 }}>{F?.features?.L_upper_dB?.toFixed(2)} dBFS</td>
                  <td style={{ padding: '4px 6px', fontWeight: 800, color: (deltaUpper || 0) > 0 ? '#FF1744' : '#00E676' }}>
                    {(deltaUpper || 0) > 0 ? `+${deltaUpper?.toFixed(2)}` : deltaUpper?.toFixed(2)} dB
                  </td>
                  <td style={{ padding: '4px 6px', color: '#64748B' }}>{thr} dBFS</td>
                  <td style={{ padding: '4px 6px' }}>
                    <span style={{
                      fontSize: '9px', padding: '1px 5px', borderRadius: '2px', fontWeight: 700,
                      background: (F?.features?.L_upper_dB || 0) > thr ? '#4D0A14' : '#0A3B22',
                      color: (F?.features?.L_upper_dB || 0) > thr ? '#FF5252' : '#69F0AE',
                      border: `1px solid ${(F?.features?.L_upper_dB || 0) > thr ? '#FF1744' : '#00E676'}`
                    }}>
                      {(F?.features?.L_upper_dB || 0) > thr ? 'ALARM: ELEVATED FLUX' : 'NORMAL: SYMMETRIC FLUX'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Dual Trace Spectrum Charts */}
          <OverlayPlot
            title="DUAL TRACE 1: FFT SPECTRUM (CARRIER ±50 Hz SPAN)"
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
            title="DUAL TRACE 2: WELCH PSD (AVERAGED NOISE REDUCTION)"
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
            title="DUAL TRACE 3: HILBERT DEMODULATED ENVELOPE MODULATION"
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

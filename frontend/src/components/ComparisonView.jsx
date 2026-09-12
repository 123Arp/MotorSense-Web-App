import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import FileUpload from './FileUpload';
import VerdictBadge from './VerdictBadge';
import { MOTORSENSE_SCREEN_LAYOUT } from './SpectrumChart';
import api from '../api';

function OverlayPlot({ title, xH, yH, xF, yF, xLabel, yLabel, f0, sbLo, sbHi, height = 260 }) {
  const shapes = [];
  if (f0) {
    shapes.push({
      type: 'line', x0: f0, x1: f0, yref: 'paper', y0: 0, y1: 1,
      line: { color: '#2979FF', width: 1.8, dash: 'solid' },
    });
  }
  if (sbLo) {
    shapes.push({
      type: 'line', x0: sbLo, x1: sbLo, yref: 'paper', y0: 0, y1: 1,
      line: { color: '#FF1744', width: 1.8, dash: 'dot' },
    });
  }
  if (sbHi) {
    shapes.push({
      type: 'line', x0: sbHi, x1: sbHi, yref: 'paper', y0: 0, y1: 1,
      line: { color: '#FF1744', width: 1.8, dash: 'dot' },
    });
  }

  const layout = {
    ...MOTORSENSE_SCREEN_LAYOUT,
    height,
    shapes,
    xaxis: { ...MOTORSENSE_SCREEN_LAYOUT.xaxis, title: { text: xLabel || 'Frequency (Hz)', font: { size: 12, color: '#90CAF9' } } },
    yaxis: { ...MOTORSENSE_SCREEN_LAYOUT.yaxis, title: { text: yLabel || 'Amplitude', font: { size: 12, color: '#90CAF9' } } },
  };

  return (
    <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '4px', padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', padding: '0 4px' }}>
        <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 700, color: '#64B5F6' }}>
          {title}
        </span>
        <div style={{ display: 'flex', gap: '14px', fontSize: '11px', fontFamily: 'monospace' }}>
          <span style={{ color: '#00E676', fontWeight: 700 }}>■ CHANNEL A: HEALTHY BENCHMARK</span>
          <span style={{ color: '#FF1744', fontWeight: 700 }}>■ CHANNEL B: EVALUATED MOTOR</span>
        </div>
      </div>
      <Plot
        data={[
          {
            x: xH || [],
            y: yH || [],
            type: 'scatter',
            mode: 'lines',
            name: 'Channel A (Healthy)',
            line: { color: '#00E676', width: 1.8 },
          },
          {
            x: xF || [],
            y: yF || [],
            type: 'scatter',
            mode: 'lines',
            name: 'Channel B (Evaluated)',
            line: { color: '#FF1744', width: 1.8 },
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

  const handlePresetCompare = async () => {
    setLoading(true);
    setError(null);
    try {
      const p1 = api.post('/api/sample/analyze', new URLSearchParams({ sample_id: 'FILE 1.mat', params: JSON.stringify(params) }));
      const p2 = api.post('/api/sample/analyze', new URLSearchParams({ sample_id: 'FILE 6.mat', params: JSON.stringify(params) }));
      const [r1, r2] = await Promise.all([p1, p2]);
      setResults({
        healthy: r1.data,
        faulty: r2.data,
        differences: {
          delta_worst_sideband_dB: (r2.data.features?.worst_sideband_dB || 0) - (r1.data.features?.worst_sideband_dB || 0),
          fault_identified: r2.data.verdict?.verdict !== 'HEALTHY',
        }
      });
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Error running preset comparison');
    } finally {
      setLoading(false);
    }
  };

  const h = results?.healthy;
  const f = results?.faulty;
  const d = results?.differences;
  const f0 = h?.sideband_info?.f_supply_hz || params.f_supply;
  const sbLo = h?.sideband_info?.f_sb_lower_hz;
  const sbHi = h?.sideband_info?.f_sb_upper_hz;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* 1-Click Preset Comparison Bar */}
      <div style={{
        background: '#0D1524',
        border: '1px solid #1E2E4A',
        borderRadius: '4px',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 800, color: '#90CAF9', fontFamily: 'monospace' }}>
            ⚡ DUAL-CHANNEL BENCHMARK COMPARATOR
          </span>
          <div style={{ fontSize: '11px', color: '#64748B' }}>
            Direct comparison between baseline healthy motor (CH-A) and suspect evaluated motor (CH-B)
          </div>
        </div>

        <button
          type="button"
          className="btn-m1k"
          style={{ height: '30px', fontSize: '12px', background: '#0F3C63', color: '#FFFFFF', borderColor: '#0284C7' }}
          onClick={handlePresetCompare}
          disabled={loading}
        >
          ▶ Compare Bundled Datasets (FILE 1 Healthy vs FILE 6 Faulty)
        </button>
      </div>

      {/* Upload Inputs Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ background: '#0F1523', border: '1px solid #1C3325', borderRadius: '4px', padding: '10px' }}>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 800, color: '#00E676', marginBottom: '8px' }}>
            CHANNEL A: HEALTHY BENCHMARK RECORDING
          </div>
          <FileUpload
            label=""
            onColumnsReady={(_, __, f) => setHealthyFile(f)}
            selectedColumn={healthyCol}
            onColumnChange={setHealthyCol}
          />
        </div>

        <div style={{ background: '#0F1523', border: '1px solid #3B161B', borderRadius: '4px', padding: '10px' }}>
          <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 800, color: '#FF5252', marginBottom: '8px' }}>
            CHANNEL B: EVALUATED / SUSPECT MOTOR RECORDING
          </div>
          <FileUpload
            label=""
            onColumnsReady={(_, __, f) => setFaultyFile(f)}
            selectedColumn={faultyCol}
            onColumnChange={setFaultyCol}
          />
        </div>
      </div>

      {healthyFile && faultyFile && (
        <button
          type="button"
          className="btn-m1k btn-m1k-run"
          style={{ width: '100%', height: '36px', fontSize: '13px' }}
          onClick={runComparison}
          disabled={loading}
        >
          {loading ? 'COMPUTING DUAL-CHANNEL SPECTRAL COHERENCE...' : '▶ RUN BENCHMARK COMPARISON (CH-A vs CH-B)'}
        </button>
      )}

      {error && (
        <div style={{ background: '#3D0A14', border: '1px solid #FF1744', color: '#FF8A80', padding: '10px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>
          ERROR: {error}
        </div>
      )}

      {loading && !results && (
        <div style={{ background: '#090D16', border: '1px solid #1D2A40', borderRadius: '4px', padding: '40px', textAlign: 'center' }}>
          <div className="inst-spinner" style={{ width: '32px', height: '32px', borderTopColor: '#00E5FF', margin: '0 auto 12px auto' }} />
          <div style={{ fontSize: '13px', fontFamily: 'monospace', color: '#00E5FF', fontWeight: 800 }}>
            COMPUTING DUAL CHANNEL CROSS-SPECTRAL DIFFERENCES...
          </div>
        </div>
      )}

      {/* Comparison Plots & Tables */}
      {results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Summary Delta Banner */}
          <div style={{
            background: '#121A2B',
            border: '1.5px solid #2563EB',
            borderRadius: '4px',
            padding: '12px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#E2E8F0', fontFamily: 'monospace' }}>
                SIDEBAND DIFFERENTIAL: Δ {d?.delta_worst_sideband_dB > 0 ? '+' : ''}{d?.delta_worst_sideband_dB?.toFixed(2)} dBFS
              </div>
              <div style={{ fontSize: '12px', color: '#90CAF9', marginTop: '2px' }}>
                {d?.fault_identified
                  ? 'CRITICAL FAULT DETECTED: Sideband modulation energy significantly elevated compared to healthy baseline.'
                  : 'NORMAL: Channel B signatures closely match baseline reference.'}
              </div>
            </div>

            <span style={{
              fontSize: '12px',
              fontFamily: 'monospace',
              fontWeight: 800,
              padding: '4px 10px',
              borderRadius: '3px',
              background: d?.fault_identified ? '#7F1D1D' : '#064E3B',
              color: d?.fault_identified ? '#FCA5A5' : '#6EE7B7',
              border: `1px solid ${d?.fault_identified ? '#EF4444' : '#10B981'}`
            }}>
              {d?.fault_identified ? 'FAULT CONFIRMED' : 'BASELINE MATCH'}
            </span>
          </div>

          <OverlayPlot
            title="DUAL-CHANNEL SPECTRUM OVERLAY [dBFS rel. f₀]"
            xH={h?.fft_zoom?.f}
            yH={h?.fft_zoom?.dB}
            xF={f?.fft_zoom?.f}
            yF={f?.fft_zoom?.dB}
            xLabel="Frequency (Hz)"
            yLabel="Relative Level (dBFS)"
            f0={f0}
            sbLo={sbLo}
            sbHi={sbHi}
            height={280}
          />

          <OverlayPlot
            title="DUAL-CHANNEL OSCILLOSCOPE TIME TRACE (CH-A vs CH-B)"
            xH={h?.raw_signal?.t}
            yH={h?.raw_signal?.x}
            xF={f?.raw_signal?.t}
            yF={f?.raw_signal?.x}
            xLabel="Time (s)"
            yLabel="Stator Current (A)"
            height={240}
          />

          {/* Verdicts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#00E676', marginBottom: '4px' }}>
                CHANNEL A VERDICT (HEALTHY):
              </div>
              <VerdictBadge verdict={h?.verdict} thresholdDB={params.threshold_dB} />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#FF5252', marginBottom: '4px' }}>
                CHANNEL B VERDICT (EVALUATED):
              </div>
              <VerdictBadge verdict={f?.verdict} thresholdDB={params.threshold_dB} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

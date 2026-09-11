import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import FileUpload from './FileUpload';
import SpectrumChart, { BASE_LAYOUT } from './SpectrumChart';
import VerdictBadge from './VerdictBadge';
import FeatureTable from './FeatureTable';
import api from '../api';

export default function PipelineView({ params, updateParam }) {
  const [file, setFile] = useState(null);
  const [column, setColumn] = useState(params.column || 'I1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);

  const handleColumnsReady = (cols, fname, f, nSamples, sizeMb) => {
    setFile(f);
    setFileMeta({ name: fname, nSamples, sizeMb });
    setError(null);
  };

  const handleColumnChange = (col) => {
    setColumn(col);
    updateParam('column', col);
  };

  const runAnalysisWithFile = async (targetFile) => {
    if (!targetFile) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append('file', targetFile);
      fd.append(
        'params',
        JSON.stringify({ ...params, column, fs: Number(params.fs) })
      );

      const res = await api.post('/api/analyze', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Pipeline analysis failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSampleSelect = async (sampleId) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFileMeta({ name: sampleId, nSamples: 1000000, sizeMb: 72.0 });

    try {
      const fd = new FormData();
      fd.append('sample_id', sampleId);
      fd.append(
        'params',
        JSON.stringify({ ...params, column, fs: Number(params.fs) })
      );
      const res = await api.post('/api/sample/analyze', fd);
      setResult(res.data);
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Sample analysis failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const sb = result?.sideband_info;
  const f0 = sb?.f_supply_hz;
  const sbLo = sb?.f_sb_lower_hz;
  const sbHi = sb?.f_sb_upper_hz;
  const thr = result?.threshold_dB ?? params.threshold_dB;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* File Upload Stage */}
      <div className="card">
        <div className="card-header">
          <span className="stage-badge">0</span>
          <div>
            <div className="stage-title">Signal Input & Channel Selection</div>
            <div className="stage-sub">Upload a 50 kHz synchronized recording (.csv or .mat) or load a bundled dataset</div>
          </div>
        </div>
        <div className="card-body">
          <FileUpload
            label=""
            onColumnsReady={handleColumnsReady}
            selectedColumn={column}
            onColumnChange={handleColumnChange}
            onSampleSelect={handleSampleSelect}
          />

          {fileMeta && (
            <div style={{ marginTop: '8px', fontSize: '11px', color: '#6B7280', fontFamily: 'monospace' }}>
              Active file: <strong>{fileMeta.name}</strong> · {fileMeta.nSamples?.toLocaleString()} samples ({((fileMeta.nSamples || 0) / params.fs).toFixed(2)}s)
            </div>
          )}

          {file && (
            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '8px', fontSize: '13px' }}
                onClick={() => runAnalysisWithFile(file)}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="spinner" />
                    Executing DSP Pipeline on {fileMeta?.name || 'file'}...
                  </>
                ) : (
                  '▶ Run Full MCSA Diagnostic Pipeline'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="banner banner-error">
          <span>⚠</span>
          <div><strong>Error:</strong> {error}</div>
        </div>
      )}

      {loading && !result && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', background: '#FFFFFF' }}>
          <div className="spinner" style={{ margin: '0 auto 12px auto', width: 36, height: 36 }} />
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937' }}>Processing DSP Pipeline...</div>
          <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
            Computing Butterworth SOS filter, Hann FFT, Welch PSD, and Hilbert analytic envelope
          </div>
        </div>
      )}

      {/* Quality Check Warnings */}
      {result?.quality_check?.warnings?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {result.quality_check.warnings.map((w, idx) => (
            <div
              key={idx}
              className={`banner ${w.severity === 'ERROR' ? 'banner-error' : 'banner-warning'}`}
            >
              <span style={{ fontSize: '16px' }}>{w.severity === 'ERROR' ? '🚫' : '⚠️'}</span>
              <div>
                <strong style={{ fontWeight: 600 }}>{w.severity} (Data Quality Check):</strong> {w.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 7-Stage Walkthrough */}
      {result && (
        <>
          {/* Stage 1: Raw Signal */}
          <div className="card">
            <div className="card-header">
              <span className="stage-badge">1</span>
              <div>
                <div className="stage-title">Raw Stator Current Signal — Time Domain</div>
                <div className="stage-sub">
                  Initial {result.raw_signal?.display_window_ms} ms window shown · {result.raw_signal?.total_samples?.toLocaleString()} total samples ({result.raw_signal?.duration_s}s) processed
                </div>
              </div>
            </div>
            <div className="card-body">
              <Plot
                data={[{
                  x: result.raw_signal?.t,
                  y: result.raw_signal?.x,
                  type: 'scatter',
                  mode: 'lines',
                  name: `Raw ${column}`,
                  line: { color: '#4B5563', width: 1 },
                }]}
                layout={{
                  ...BASE_LAYOUT,
                  height: 200,
                  xaxis: { ...BASE_LAYOUT.xaxis, title: { text: 'Time (seconds)', font: { size: 11 } } },
                  yaxis: { ...BASE_LAYOUT.yaxis, title: { text: 'Current (Amperes)', font: { size: 11 } } },
                }}
                config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
                style={{ width: '100%' }}
                useResizeHandler
              />
            </div>
          </div>

          {/* Stage 2: Bandpass Filter */}
          <div className="card">
            <div className="card-header">
              <span className="stage-badge">2</span>
              <div>
                <div className="stage-title">Bandpass Filtered Signal (SOS Form)</div>
                <div className="stage-sub">
                  Butterworth order-{result.filtered_signal?.order} SOS filter ({result.filtered_signal?.low_cut_hz} Hz – {result.filtered_signal?.high_cut_hz} Hz passband) · Zero-phase sosfiltfilt
                </div>
              </div>
            </div>
            <div className="card-body">
              <Plot
                data={[
                  {
                    x: result.filtered_signal?.t,
                    y: result.filtered_signal?.raw,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Raw Signal',
                    opacity: 0.35,
                    line: { color: '#9CA3AF', width: 1 },
                  },
                  {
                    x: result.filtered_signal?.t,
                    y: result.filtered_signal?.filtered,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'SOS Filtered',
                    line: { color: '#1A56DB', width: 1.5 },
                  },
                ]}
                layout={{
                  ...BASE_LAYOUT,
                  height: 200,
                  xaxis: { ...BASE_LAYOUT.xaxis, title: { text: 'Time (seconds)', font: { size: 11 } } },
                  yaxis: { ...BASE_LAYOUT.yaxis, title: { text: 'Current (Amperes)', font: { size: 11 } } },
                }}
                config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
                style={{ width: '100%' }}
                useResizeHandler
              />
            </div>
          </div>

          {/* Stage 3: FFT Spectrum */}
          <div className="card">
            <div className="card-header">
              <span className="stage-badge">3</span>
              <div>
                <div className="stage-title">FFT Amplitude Spectrum (Hann Windowed)</div>
                <div className="stage-sub">
                  Resolution Δf = {result.fft?.freq_resolution_hz?.toFixed(4)} Hz · Coherent-gain corrected · Sidelobes suppressed to reveal fault sidebands
                </div>
              </div>
            </div>
            <div className="card-body">
              <SpectrumChart
                title=""
                xFull={result.fft?.freqs_full}
                yFull={result.fft?.mag_full}
                xZoom={result.fft?.freqs_zoom}
                yZoom={result.fft?.mag_zoom}
                xLabel="Frequency (Hz)"
                yLabel="Amplitude (A)"
                traceName={`FFT (${column})`}
                traceColor="#1A56DB"
                f_supply={f0}
                f_sb_lower={sbLo}
                f_sb_upper={sbHi}
                height={260}
              />
            </div>
          </div>

          {/* Stage 4: Welch PSD */}
          <div className="card">
            <div className="card-header">
              <span className="stage-badge">4</span>
              <div>
                <div className="stage-title">Welch Power Spectral Density (PSD)</div>
                <div className="stage-sub">
                  Averaged periodogram across 50% overlapping segments · Suppresses noise variance for reliable sideband detection
                </div>
              </div>
            </div>
            <div className="card-body">
              <SpectrumChart
                title=""
                xFull={result.welch_psd?.freqs_full}
                yFull={result.welch_psd?.psd_db_full}
                xZoom={result.welch_psd?.freqs_zoom}
                yZoom={result.welch_psd?.psd_db_zoom}
                xLabel="Frequency (Hz)"
                yLabel="PSD (dB/Hz)"
                traceName={`Welch PSD (${column})`}
                traceColor="#7C3AED"
                f_supply={f0}
                f_sb_lower={sbLo}
                f_sb_upper={sbHi}
                height={260}
              />
            </div>
          </div>

          {/* Stage 5: Hilbert Envelope Spectrum */}
          <div className="card">
            <div className="card-header">
              <span className="stage-badge">5</span>
              <div>
                <div className="stage-title">Hilbert Transform Envelope Spectrum</div>
                <div className="stage-sub">
                  Analytic signal |z(t)| → DC stripped → FFT · Direct isolation of fault amplitude modulation (AM) patterns
                </div>
              </div>
            </div>
            <div className="card-body">
              <SpectrumChart
                title=""
                xFull={result.hilbert_envelope?.freqs_full}
                yFull={result.hilbert_envelope?.mag_full}
                xZoom={result.hilbert_envelope?.freqs_zoom}
                yZoom={result.hilbert_envelope?.mag_zoom}
                xLabel="Modulation Frequency (Hz)"
                yLabel="Envelope Amplitude"
                traceName={`Envelope Spectrum (${column})`}
                traceColor="#D97706"
                f_supply={f0}
                f_sb_lower={sbLo}
                f_sb_upper={sbHi}
                defaultView="full"
                height={260}
              />
            </div>
          </div>

          {/* Stage 6: Feature Extraction */}
          <div className="card">
            <div className="card-header">
              <span className="stage-badge">6</span>
              <div>
                <div className="stage-title">Sideband Feature Extraction & Kinematics</div>
                <div className="stage-sub">
                  Peak search within ±2 Hz of nominal sidebands · Decibel ratio L_dB = 20·log₁₀(A_sb / A_fund)
                </div>
              </div>
            </div>
            <div className="card-body">
              <FeatureTable
                features={result.features}
                sidebandInfo={result.sideband_info}
                thresholdDB={thr}
              />
            </div>
          </div>

          {/* Stage 7: Health Verdict */}
          <div className="card">
            <div className="card-header">
              <span className="stage-badge">7</span>
              <div>
                <div className="stage-title">Diagnostic Verdict & Machine Health Status</div>
                <div className="stage-sub">
                  Automated rule-based evaluation: Worst sideband level vs. {thr} dB threshold
                </div>
              </div>
            </div>
            <div className="card-body">
              <VerdictBadge verdict={result.verdict} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import FileUpload from './FileUpload';
import SpectrumChart, { BASE_LAYOUT } from './SpectrumChart';
import VerdictBadge from './VerdictBadge';
import FeatureTable from './FeatureTable';
import ReportModal from './ReportModal';
import { WaveformIcon, FilterIcon, SpectrumIcon, PsdIcon, EnvelopeIcon, TableIcon, DownloadIcon } from './Icons';
import api from '../api';

export default function PipelineView({ params, updateParam }) {
  const [file, setFile] = useState(null);
  const [column, setColumn] = useState(params.column || 'I1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [isReportOpen, setIsReportOpen] = useState(false);

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Stage 0: File Ingestion Chassis */}
      <div className="inst-panel">
        <div className="inst-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="stage-tag">STAGE 00</span>
            <span className="stage-title-text">SIGNAL STREAM INGESTION & CHANNEL CONFIGURATION</span>
          </div>
          <span className="stage-meta-text">CLOCK: {params.fs?.toLocaleString()} Hz</span>
        </div>
        <div className="inst-panel-body">
          <FileUpload
            label=""
            onColumnsReady={handleColumnsReady}
            selectedColumn={column}
            onColumnChange={handleColumnChange}
            onSampleSelect={handleSampleSelect}
          />

          {fileMeta && (
            <div style={{ marginTop: '10px', fontSize: '11px', color: '#475569', fontFamily: 'monospace', background: '#F8FAFC', padding: '6px 10px', border: '1px solid #E2E8F0', borderRadius: '2px', display: 'flex', justifyContent: 'space-between' }}>
              <span>ACTIVE RECORDING: <strong>{fileMeta.name}</strong></span>
              <span>SAMPLES: <strong>{fileMeta.nSamples?.toLocaleString()}</strong> ({((fileMeta.nSamples || 0) / params.fs).toFixed(2)}s duration)</span>
            </div>
          )}

          {file && (
            <div style={{ marginTop: '12px' }}>
              <button
                type="button"
                className="btn-inst-primary"
                style={{ width: '100%', height: '36px', fontSize: '13px' }}
                onClick={() => runAnalysisWithFile(file)}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div className="inst-spinner" />
                    EXECUTING 7-STAGE DSP DIAGNOSTIC KERNEL...
                  </>
                ) : (
                  'EXECUTE FULL MCSA DSP DIAGNOSTIC PIPELINE'
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="inst-banner inst-banner-alert">
          <div><strong>Diagnostic Execution Failed:</strong> {error}</div>
        </div>
      )}

      {loading && !result && (
        <div className="inst-panel" style={{ padding: '32px', textAlign: 'center' }}>
          <div className="inst-spinner" style={{ margin: '0 auto 12px auto', width: '32px', height: '32px' }} />
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
            COMPUTING FULL FREQUENCY-DOMAIN TRANSFORMATIONS...
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
            Executing Butterworth SOS filter → Hann FFT (1M points) → Welch PSD averaging → Hilbert analytic demodulation
          </div>
        </div>
      )}

      {/* Quality Check Warnings */}
      {result?.quality_check?.warnings?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {result.quality_check.warnings.map((w, idx) => (
            <div
              key={idx}
              className={`inst-banner ${w.severity === 'ERROR' ? 'inst-banner-alert' : 'inst-banner-warning'}`}
            >
              <div>
                <strong style={{ fontFamily: 'monospace' }}>[{w.severity} — SIGNAL QUALITY CRITERION]:</strong> {w.message}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 7-STAGE WALKTHROUGH */}
      {result && (
        <>
          {/* Top Bar for Report Generation */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8FAFC', border: '1px solid #CBD5E1', padding: '10px 14px', borderRadius: '2px' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                MCSA DIAGNOSTIC RESULT:
              </span>{' '}
              <span style={{
                fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', padding: '2px 8px', borderRadius: '2px',
                background: result.verdict?.verdict === 'HEALTHY' ? '#DCFCE7' : '#FEE2E2',
                color: result.verdict?.verdict === 'HEALTHY' ? '#15803D' : '#B91C1C'
              }}>
                {result.verdict?.label} ({result.features?.worst_sideband_dB?.toFixed(2)} dBFS)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="btn-inst-secondary"
              style={{ background: '#0F4C81', color: '#FFFFFF', borderColor: '#0A355C', fontWeight: 600 }}
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              GENERATE ISO 20958 DIAGNOSTIC SHEET
            </button>
          </div>

          {/* STAGE 1: RAW SIGNAL */}
          <div className="inst-panel">
            <div className="inst-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="stage-tag">STAGE 01</span>
                <WaveformIcon className="w-4 h-4 text-slate-700" />
                <span className="stage-title-text">RAW STATOR CURRENT WAVEFORM — TIME DOMAIN</span>
              </div>
              <span className="stage-meta-text">
                DISPLAY: {result.raw_signal?.display_window_ms} ms · TOTAL: {result.raw_signal?.total_samples?.toLocaleString()} PTS ({result.raw_signal?.duration_s}s)
              </span>
            </div>
            <div className="inst-panel-body">
              <Plot
                data={[{
                  x: result.raw_signal?.t,
                  y: result.raw_signal?.x,
                  type: 'scatter',
                  mode: 'lines',
                  name: `Raw Current (${column})`,
                  line: { color: '#475569', width: 1.2 },
                }]}
                layout={{
                  ...BASE_LAYOUT,
                  height: 200,
                  xaxis: { ...BASE_LAYOUT.xaxis, title: { text: 'Time (seconds)', font: { size: 11, color: '#475569' } } },
                  yaxis: { ...BASE_LAYOUT.yaxis, title: { text: 'Current (Amperes)', font: { size: 11, color: '#475569' } } },
                }}
                config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
                style={{ width: '100%' }}
                useResizeHandler
              />
            </div>
          </div>

          {/* STAGE 2: BANDPASS FILTER */}
          <div className="inst-panel">
            <div className="inst-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="stage-tag">STAGE 02</span>
                <FilterIcon className="w-4 h-4 text-slate-700" />
                <span className="stage-title-text">CASCADED SECOND-ORDER-SECTIONS (SOS) BUTTERWORTH FILTER</span>
              </div>
              <span className="stage-meta-text">
                PASSBAND: {result.filtered_signal?.low_cut_hz} Hz – {result.filtered_signal?.high_cut_hz} Hz · ORDER: {result.filtered_signal?.order} · ZERO-PHASE
              </span>
            </div>
            <div className="inst-panel-body">
              <Plot
                data={[
                  {
                    x: result.filtered_signal?.t,
                    y: result.filtered_signal?.raw,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Raw Unfiltered',
                    opacity: 0.35,
                    line: { color: '#94A3B8', width: 1 },
                  },
                  {
                    x: result.filtered_signal?.t,
                    y: result.filtered_signal?.filtered,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'SOS Filtered Stator Current',
                    line: { color: '#0F4C81', width: 1.5 },
                  },
                ]}
                layout={{
                  ...BASE_LAYOUT,
                  height: 200,
                  xaxis: { ...BASE_LAYOUT.xaxis, title: { text: 'Time (seconds)', font: { size: 11, color: '#475569' } } },
                  yaxis: { ...BASE_LAYOUT.yaxis, title: { text: 'Filtered Current (Amperes)', font: { size: 11, color: '#475569' } } },
                }}
                config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
                style={{ width: '100%' }}
                useResizeHandler
              />
            </div>
          </div>

          {/* STAGE 3: FFT SPECTRUM */}
          <div className="inst-panel">
            <div className="inst-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="stage-tag">STAGE 03</span>
                <SpectrumIcon className="w-4 h-4 text-slate-700" />
                <span className="stage-title-text">HANN-WINDOWED DISCRETE FOURIER TRANSFORM (FFT)</span>
              </div>
              <span className="stage-meta-text">
                BIN RESOLUTION: Δf = {result.fft?.freq_resolution_hz?.toFixed(4)} Hz · LEAKAGE ATTENUATION: ~-31 dB
              </span>
            </div>
            <div className="inst-panel-body">
              <SpectrumChart
                title="METHOD 1: AMPLITUDE SPECTRUM (PEAK NORMALIZED)"
                xFull={result.fft?.freqs_full}
                yFull={result.fft?.mag_full}
                xZoom={result.fft?.freqs_zoom}
                yZoom={result.fft?.mag_zoom}
                xLabel="Frequency (Hz)"
                yLabel="Amplitude (Arms)"
                traceName={`FFT Spectrum (${column})`}
                traceColor="#0F4C81"
                f_supply={f0}
                f_sb_lower={sbLo}
                f_sb_upper={sbHi}
                height={260}
              />
            </div>
          </div>

          {/* STAGE 4: WELCH PSD */}
          <div className="inst-panel">
            <div className="inst-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="stage-tag">STAGE 04</span>
                <PsdIcon className="w-4 h-4 text-slate-700" />
                <span className="stage-title-text">WELCH POWER SPECTRAL DENSITY (PSD) ESTIMATION</span>
              </div>
              <span className="stage-meta-text">
                WINDOW: HANN · SEGMENTS: 50% OVERLAP · STATISTICAL VARIANCE REDUCTION
              </span>
            </div>
            <div className="inst-panel-body">
              <SpectrumChart
                title="METHOD 2: AVERAGED POWER DENSITY ESTIMATE (dBFS/Hz)"
                xFull={result.welch_psd?.freqs_full}
                yFull={result.welch_psd?.psd_db_full}
                xZoom={result.welch_psd?.freqs_zoom}
                yZoom={result.welch_psd?.psd_db_zoom}
                xLabel="Frequency (Hz)"
                yLabel="Power Spectral Density (dB/Hz)"
                traceName={`Welch PSD (${column})`}
                traceColor="#5B21B6"
                f_supply={f0}
                f_sb_lower={sbLo}
                f_sb_upper={sbHi}
                height={260}
              />
            </div>
          </div>

          {/* STAGE 5: HILBERT ENVELOPE */}
          <div className="inst-panel">
            <div className="inst-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="stage-tag">STAGE 05</span>
                <EnvelopeIcon className="w-4 h-4 text-slate-700" />
                <span className="stage-title-text">HILBERT TRANSFORM DEMODULATED ENVELOPE SPECTRUM</span>
              </div>
              <span className="stage-meta-text">
                ANALYTIC: |z(t)| → ZERO-DC → FFT · MECHANICAL FAULT AM DEMODULATION
              </span>
            </div>
            <div className="inst-panel-body">
              <SpectrumChart
                title="METHOD 3: DEMODULATED AMPLITUDE MODULATION ENVELOPE"
                xFull={result.hilbert_envelope?.freqs_full}
                yFull={result.hilbert_envelope?.mag_full}
                xZoom={result.hilbert_envelope?.freqs_zoom}
                yZoom={result.hilbert_envelope?.mag_zoom}
                xLabel="Modulation Frequency (Hz)"
                yLabel="Envelope Magnitude"
                traceName={`Envelope Spectrum (${column})`}
                traceColor="#B45309"
                f_supply={f0}
                f_sb_lower={sbLo}
                f_sb_upper={sbHi}
                defaultView="full"
                height={260}
              />
            </div>
          </div>

          {/* STAGE 6: FEATURE EXTRACTION */}
          <div className="inst-panel">
            <div className="inst-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="stage-tag">STAGE 06</span>
                <TableIcon className="w-4 h-4 text-slate-700" />
                <span className="stage-title-text">FEATURE EXTRACTION & DECIBEL LEVEL NORMALIZATION</span>
              </div>
              <span className="stage-meta-text">
                PEAK SEARCH: ±2.0 Hz WINDOW · METRIC: L_dB = 20·log₁₀(A_sb / A_fund)
              </span>
            </div>
            <div className="inst-panel-body">
              <FeatureTable
                features={result.features}
                sidebandInfo={result.sideband_info}
                thresholdDB={thr}
              />
            </div>
          </div>

          {/* STAGE 7: HEALTH VERDICT */}
          <div className="inst-panel">
            <div className="inst-panel-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="stage-tag">STAGE 07</span>
                <span className="stage-title-text">DIAGNOSTIC HEALTH VERDICT & MACHINERY ASSESSMENT</span>
              </div>
              <span className="stage-meta-text">
                THRESHOLD BOUNDARY: {thr} dBFS · ISO 20958 CONFORMANCE
              </span>
            </div>
            <div className="inst-panel-body">
              <VerdictBadge verdict={result.verdict} thresholdDB={thr} />
            </div>
          </div>
        </>
      )}

      {/* ISO 20958 Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        result={result}
        params={params}
        filename={fileMeta?.name}
      />
    </div>
  );
}

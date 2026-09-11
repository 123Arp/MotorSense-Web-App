import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import FileUpload from './FileUpload';
import SpectrumChart, { ALICE_SCREEN_LAYOUT } from './SpectrumChart';
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
      const msg = err?.response?.data?.detail || err.message || 'Analysis error';
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
      const msg = err?.response?.data?.detail || err.message || 'Sample analysis error';
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {/* File Acquisition Module */}
      <div style={{ background: '#0F1523', border: '1px solid #223048', borderRadius: '3px', padding: '8px' }}>
        <FileUpload
          label=""
          onColumnsReady={handleColumnsReady}
          selectedColumn={column}
          onColumnChange={handleColumnChange}
          onSampleSelect={handleSampleSelect}
        />

        {fileMeta && (
          <div style={{ marginTop: '6px', fontSize: '10px', color: '#64B5F6', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', background: '#090E18', padding: '4px 8px', border: '1px solid #1C2B42', borderRadius: '2px' }}>
            <span>BUFFER: <strong>{fileMeta.name}</strong></span>
            <span>LENGTH: <strong>{fileMeta.nSamples?.toLocaleString()}</strong> SAMPLES ({((fileMeta.nSamples || 0) / params.fs).toFixed(2)}s)</span>
          </div>
        )}

        {file && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="btn-m1k btn-m1k-run"
              style={{ flex: 1, height: '32px', fontSize: '12px' }}
              onClick={() => runAnalysisWithFile(file)}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="inst-spinner" style={{ borderTopColor: '#FFFFFF' }} />
                  ACQUIRING &amp; PROCESSING MCSA WAVEFORMS...
                </>
              ) : (
                '▶ RUN MCSA DIAGNOSTIC ACQUISITION'
              )}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: '#3D0A14', border: '1px solid #FF1744', color: '#FF8A80', padding: '8px 10px', borderRadius: '2px', fontSize: '11px', fontFamily: 'monospace' }}>
          ERROR: {error}
        </div>
      )}

      {loading && !result && (
        <div style={{ background: '#090D16', border: '1px solid #1D2A40', borderRadius: '3px', padding: '30px', textAlign: 'center' }}>
          <div className="inst-spinner" style={{ width: '28px', height: '28px', borderTopColor: '#00E5FF', margin: '0 auto 8px auto' }} />
          <div style={{ fontSize: '12px', fontFamily: 'monospace', color: '#00E5FF', fontWeight: 700 }}>
            COMPUTING DSP PIPELINE TRANSFORMS (50 kS/s)...
          </div>
        </div>
      )}

      {/* Quality Check Warnings */}
      {result?.quality_check?.warnings?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {result.quality_check.warnings.map((w, idx) => (
            <div
              key={idx}
              style={{
                background: w.severity === 'ERROR' ? '#3B0F15' : '#3B2F0F',
                border: `1px solid ${w.severity === 'ERROR' ? '#FF1744' : '#FFD600'}`,
                color: w.severity === 'ERROR' ? '#FF8A80' : '#FFF59D',
                padding: '6px 10px',
                borderRadius: '2px',
                fontSize: '10px',
                fontFamily: 'monospace'
              }}
            >
              [{w.severity}]: {w.message}
            </div>
          ))}
        </div>
      )}

      {/* 7-Stage Walkthrough */}
      {result && (
        <>
          {/* Action Ribbon */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#121A2B', border: '1px solid #233452', padding: '6px 10px', borderRadius: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#90CAF9' }}>
                EVALUATION RESULT:
              </span>
              <span style={{
                fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, padding: '2px 8px', borderRadius: '2px',
                background: result.verdict?.verdict === 'HEALTHY' ? '#00E676' : '#FF1744',
                color: '#000000'
              }}>
                {result.verdict?.label} ({result.features?.worst_sideband_dB?.toFixed(2)} dBFS)
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="btn-m1k"
              style={{ background: '#005A9C', color: '#FFFFFF', borderColor: '#0084E3' }}
            >
              <DownloadIcon className="w-3 h-3" />
              PRINT ISO 20958 REPORT
            </button>
          </div>

          {/* STAGE 1: Oscilloscope Time Domain */}
          <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '3px', padding: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', padding: '0 4px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#00E5FF' }}>
                STAGE 01: TIME-DOMAIN OSCILLOSCOPE TRACE (CH A: {column})
              </span>
              <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#64B5F6' }}>
                WINDOW: {result.raw_signal?.display_window_ms} ms · TOTAL PTS: {result.raw_signal?.total_samples?.toLocaleString()}
              </span>
            </div>
            <Plot
              data={[{
                x: result.raw_signal?.t,
                y: result.raw_signal?.x,
                type: 'scatter',
                mode: 'lines',
                name: `CH A (${column})`,
                line: { color: '#00E5FF', width: 1.5 },
              }]}
              layout={{
                ...ALICE_SCREEN_LAYOUT,
                height: 190,
                xaxis: { ...ALICE_SCREEN_LAYOUT.xaxis, title: { text: 'Time (seconds)', font: { size: 10, color: '#90CAF9' } } },
                yaxis: { ...ALICE_SCREEN_LAYOUT.yaxis, title: { text: 'Current (A)', font: { size: 10, color: '#90CAF9' } } },
              }}
              config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
              style={{ width: '100%' }}
              useResizeHandler
            />
          </div>

          {/* STAGE 2: Filtered vs Raw */}
          <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '3px', padding: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', padding: '0 4px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#FFB300' }}>
                STAGE 02: BUTTERWORTH SOS BANDPASS FILTER (1.0 - 200.0 Hz)
              </span>
              <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#64B5F6' }}>
                ZERO-PHASE CASCADE · ORDER 4
              </span>
            </div>
            <Plot
              data={[
                {
                  x: result.filtered_signal?.t,
                  y: result.filtered_signal?.raw,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'Raw Unfiltered',
                  opacity: 0.35,
                  line: { color: '#78909C', width: 1 },
                },
                {
                  x: result.filtered_signal?.t,
                  y: result.filtered_signal?.filtered,
                  type: 'scatter',
                  mode: 'lines',
                  name: 'SOS Filtered Stator Current',
                  line: { color: '#FFB300', width: 1.5 },
                },
              ]}
              layout={{
                ...ALICE_SCREEN_LAYOUT,
                height: 190,
                xaxis: { ...ALICE_SCREEN_LAYOUT.xaxis, title: { text: 'Time (seconds)', font: { size: 10, color: '#90CAF9' } } },
                yaxis: { ...ALICE_SCREEN_LAYOUT.yaxis, title: { text: 'Current (A)', font: { size: 10, color: '#90CAF9' } } },
              }}
              config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
              style={{ width: '100%' }}
              useResizeHandler
            />
          </div>

          {/* STAGE 3: FFT Spectrum */}
          <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '3px', padding: '6px' }}>
            <SpectrumChart
              title="STAGE 03: HANN-WINDOWED DISCRETE FOURIER TRANSFORM (FFT SPECTRUM)"
              xFull={result.fft?.freqs_full}
              yFull={result.fft?.mag_full}
              xZoom={result.fft?.freqs_zoom}
              yZoom={result.fft?.mag_zoom}
              xLabel="Frequency (Hz)"
              yLabel="Amplitude (Arms)"
              traceName={`FFT (${column})`}
              traceColor="#00E5FF"
              f_supply={f0}
              f_sb_lower={sbLo}
              f_sb_upper={sbHi}
              height={240}
            />
          </div>

          {/* STAGE 4: Welch PSD */}
          <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '3px', padding: '6px' }}>
            <SpectrumChart
              title="STAGE 04: WELCH POWER SPECTRAL DENSITY ESTIMATE (PSD)"
              xFull={result.welch_psd?.freqs_full}
              yFull={result.welch_psd?.psd_db_full}
              xZoom={result.welch_psd?.freqs_zoom}
              yZoom={result.welch_psd?.psd_db_zoom}
              xLabel="Frequency (Hz)"
              yLabel="PSD (dB/Hz)"
              traceName={`Welch (${column})`}
              traceColor="#B388FF"
              f_supply={f0}
              f_sb_lower={sbLo}
              f_sb_upper={sbHi}
              height={240}
            />
          </div>

          {/* STAGE 5: Hilbert Envelope */}
          <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '3px', padding: '6px' }}>
            <SpectrumChart
              title="STAGE 05: HILBERT TRANSFORM DEMODULATED ENVELOPE SPECTRUM"
              xFull={result.hilbert_envelope?.freqs_full}
              yFull={result.hilbert_envelope?.mag_full}
              xZoom={result.hilbert_envelope?.freqs_zoom}
              yZoom={result.hilbert_envelope?.mag_zoom}
              xLabel="Modulation Frequency (Hz)"
              yLabel="Envelope Magnitude"
              traceName={`Envelope (${column})`}
              traceColor="#FFD600"
              f_supply={f0}
              f_sb_lower={sbLo}
              f_sb_upper={sbHi}
              defaultView="full"
              height={240}
            />
          </div>

          {/* STAGE 6: Feature Extraction Table */}
          <FeatureTable
            features={result.features}
            sidebandInfo={result.sideband_info}
            thresholdDB={thr}
          />

          {/* STAGE 7: Verdict */}
          <VerdictBadge verdict={result.verdict} thresholdDB={thr} />
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

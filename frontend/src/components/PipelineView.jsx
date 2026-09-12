import React, { useState } from 'react';
import Plot from 'react-plotly.js';
import FileUpload from './FileUpload';
import SpectrumChart, { MOTORSENSE_SCREEN_LAYOUT } from './SpectrumChart';
import VerdictBadge from './VerdictBadge';
import FeatureTable from './FeatureTable';
import ConditionGauge from './ConditionGauge';
import ReportModal from './ReportModal';
import { WaveformIcon, FilterIcon, SpectrumIcon, PsdIcon, EnvelopeIcon, TableIcon, DownloadIcon, GaugeIcon } from './Icons';
import api from '../api';

export default function PipelineView({ params, updateParam }) {
  const [file, setFile] = useState(null);
  const [column, setColumn] = useState(params.column || 'I1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [fileMeta, setFileMeta] = useState(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState('spectrum'); // 'spectrum', 'oscilloscope', 'pipeline'

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

  // Export Spectrum as CSV
  const handleExportCsv = () => {
    if (!result?.fft?.f || !result?.fft?.linear) return;
    const fArr = result.fft.f;
    const magArr = result.fft.linear;
    let csvContent = 'data:text/csv;charset=utf-8,Frequency_Hz,Magnitude_A\n';
    for (let i = 0; i < fArr.length; i++) {
      csvContent += `${fArr[i]},${magArr[i]}\n`;
    }
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `MotorSense_Spectrum_${fileMeta?.name || 'Dataset'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sb = result?.sideband_info;
  const f0 = sb?.f_supply_hz;
  const sbLo = sb?.f_sb_lower_hz;
  const sbHi = sb?.f_sb_upper_hz;
  const thr = result?.threshold_dB ?? params.threshold_dB;
  const worstDb = result?.features?.worst_sideband_dB;
  const isHealthy = result?.verdict?.verdict === 'HEALTHY';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* File Acquisition & Quick Demo Module */}
      <div style={{ background: '#0F1523', border: '1px solid #223048', borderRadius: '4px', padding: '10px' }}>
        <FileUpload
          onColumnsReady={handleColumnsReady}
          selectedColumn={column}
          onColumnChange={handleColumnChange}
          onSampleSelect={handleSampleSelect}
        />

        {fileMeta && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64B5F6', fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', background: '#090E18', padding: '6px 10px', border: '1px solid #1C2B42', borderRadius: '3px' }}>
            <span>DATA BUFFER: <strong>{fileMeta.name}</strong></span>
            <span>RECORD: <strong>{fileMeta.nSamples?.toLocaleString()}</strong> SAMPLES ({((fileMeta.nSamples || 0) / params.fs).toFixed(2)}s @ {params.fs?.toLocaleString()} Hz)</span>
          </div>
        )}

        {file && (
          <div style={{ marginTop: '10px' }}>
            <button
              type="button"
              className="btn-m1k btn-m1k-run"
              style={{ width: '100%', height: '36px', fontSize: '13px' }}
              onClick={() => runAnalysisWithFile(file)}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="inst-spinner" style={{ borderTopColor: '#FFFFFF' }} />
                  ACQUIRING &amp; RUNNING MCSA PIPELINE...
                </>
              ) : (
                '▶ RUN MCSA DIAGNOSTIC ACQUISITION'
              )}
            </button>
          </div>
        )}
      </div>

      {error && (
        <div style={{ background: '#3D0A14', border: '1.5px solid #FF1744', color: '#FF8A80', padding: '10px 12px', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }}>
          ERROR: {error}
        </div>
      )}

      {loading && !result && (
        <div style={{ background: '#090D16', border: '1px solid #1D2A40', borderRadius: '4px', padding: '40px', textAlign: 'center' }}>
          <div className="inst-spinner" style={{ width: '32px', height: '32px', borderTopColor: '#00E5FF', margin: '0 auto 12px auto' }} />
          <div style={{ fontSize: '14px', fontFamily: 'monospace', color: '#00E5FF', fontWeight: 800 }}>
            COMPUTING 7-STAGE MCSA TRANSFORM PIPELINE (50 kS/s)...
          </div>
          <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px' }}>
            Applying Butterworth SOS filter, Hilbert Demodulation &amp; FFT
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
                padding: '6px 12px',
                borderRadius: '3px',
                fontSize: '11px',
                fontFamily: 'monospace'
              }}
            >
              [{w.severity}]: {w.message}
            </div>
          ))}
        </div>
      )}

      {/* Results Dashboard & Views */}
      {result && (
        <>
          {/* Top Instrumentation Action Bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#121A2B',
            border: '1px solid #233452',
            padding: '8px 12px',
            borderRadius: '4px',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            {/* View Mode Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#90CAF9', fontFamily: 'monospace', marginRight: '6px' }}>
                DISPLAY MODE:
              </span>
              <button
                type="button"
                className="btn-m1k"
                style={{
                  height: '28px',
                  fontSize: '12px',
                  background: displayMode === 'spectrum' ? '#005A9C' : '#141E30',
                  color: displayMode === 'spectrum' ? '#FFFFFF' : '#94A3B8',
                  borderColor: displayMode === 'spectrum' ? '#0084E3' : '#223450',
                }}
                onClick={() => setDisplayMode('spectrum')}
              >
                <SpectrumIcon className="w-3.5 h-3.5" />
                Spectrum Analyzer (FFT)
              </button>
              <button
                type="button"
                className="btn-m1k"
                style={{
                  height: '28px',
                  fontSize: '12px',
                  background: displayMode === 'oscilloscope' ? '#005A9C' : '#141E30',
                  color: displayMode === 'oscilloscope' ? '#FFFFFF' : '#94A3B8',
                  borderColor: displayMode === 'oscilloscope' ? '#0084E3' : '#223450',
                }}
                onClick={() => setDisplayMode('oscilloscope')}
              >
                <WaveformIcon className="w-3.5 h-3.5" />
                Oscilloscope (Time Trace)
              </button>
              <button
                type="button"
                className="btn-m1k"
                style={{
                  height: '28px',
                  fontSize: '12px',
                  background: displayMode === 'pipeline' ? '#005A9C' : '#141E30',
                  color: displayMode === 'pipeline' ? '#FFFFFF' : '#94A3B8',
                  borderColor: displayMode === 'pipeline' ? '#0084E3' : '#223450',
                }}
                onClick={() => setDisplayMode('pipeline')}
              >
                <TableIcon className="w-3.5 h-3.5" />
                7-Stage Full Pipeline
              </button>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={handleExportCsv}
                className="btn-m1k"
                style={{ height: '28px', fontSize: '12px', background: '#162238', color: '#38BDF8', borderColor: '#2563EB' }}
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                Export CSV
              </button>

              <button
                type="button"
                onClick={() => setIsReportOpen(true)}
                className="btn-m1k-run"
                style={{ height: '28px', fontSize: '12px', padding: '0 12px' }}
              >
                <DownloadIcon className="w-3.5 h-3.5" />
                Print ISO 20958 Report
              </button>
            </div>
          </div>

          {/* Severity Speedometer Meter & Verdict Badge Side by Side */}
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '10px' }}>
            <ConditionGauge worstDb={worstDb} thresholdDb={thr} isHealthy={isHealthy} />
            <VerdictBadge verdict={result.verdict} thresholdDB={thr} />
          </div>

          {/* VIEW MODE 1: Spectrum Analyzer */}
          {displayMode === 'spectrum' && (
            <>
              <SpectrumChart
                title="HIGH-RESOLUTION MCSA CURRENT SPECTRUM [dBFS rel. CARRIER f₀]"
                xFull={result.fft?.f}
                yFull={result.fft?.dB}
                xZoom={result.fft_zoom?.f}
                yZoom={result.fft_zoom?.dB}
                xLabel="Frequency (Hz)"
                yLabel="Relative Level (dBFS)"
                traceName={`Stator Current (${column})`}
                traceColor="#00E5FF"
                f_supply={f0}
                f_sb_lower={sbLo}
                f_sb_upper={sbHi}
                height={320}
              />
              <FeatureTable
                features={result.features}
                sidebandInfo={result.sideband_info}
                thresholdDB={thr}
              />
            </>
          )}

          {/* VIEW MODE 2: Time-Domain Oscilloscope */}
          {displayMode === 'oscilloscope' && (
            <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '4px', padding: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '0 4px' }}>
                <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 700, color: '#00E5FF' }}>
                  STATOR CURRENT OSCILLOSCOPE TRACE (CHANNEL {column})
                </span>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64B5F6' }}>
                  WINDOW: {result.raw_signal?.display_window_ms} ms · TOTAL POINTS: {result.raw_signal?.total_samples?.toLocaleString()}
                </span>
              </div>
              <Plot
                data={[{
                  x: result.raw_signal?.t,
                  y: result.raw_signal?.x,
                  type: 'scatter',
                  mode: 'lines',
                  name: `CH (${column}) Current`,
                  line: { color: '#00E5FF', width: 1.8 },
                }]}
                layout={{
                  ...MOTORSENSE_SCREEN_LAYOUT,
                  height: 320,
                  xaxis: { ...MOTORSENSE_SCREEN_LAYOUT.xaxis, title: { text: 'Time (seconds)', font: { size: 12, color: '#90CAF9' } } },
                  yaxis: { ...MOTORSENSE_SCREEN_LAYOUT.yaxis, title: { text: 'Stator Current (A)', font: { size: 12, color: '#90CAF9' } } },
                }}
                config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
                style={{ width: '100%' }}
                useResizeHandler
              />
            </div>
          )}

          {/* VIEW MODE 3: Full 7-Stage Pipeline Walkthrough */}
          {displayMode === 'pipeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* STAGE 1: Time Domain */}
              <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '4px', padding: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', padding: '0 4px' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#00E5FF' }}>
                    STAGE 01: RAW STATOR CURRENT ACQUISITION (CH: {column})
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64B5F6' }}>
                    WINDOW: {result.raw_signal?.display_window_ms} ms · SAMPLES: {result.raw_signal?.total_samples?.toLocaleString()}
                  </span>
                </div>
                <Plot
                  data={[{
                    x: result.raw_signal?.t,
                    y: result.raw_signal?.x,
                    type: 'scatter',
                    mode: 'lines',
                    name: `Raw Current (${column})`,
                    line: { color: '#00E5FF', width: 1.5 },
                  }]}
                  layout={{
                    ...MOTORSENSE_SCREEN_LAYOUT,
                    height: 200,
                    xaxis: { ...MOTORSENSE_SCREEN_LAYOUT.xaxis, title: { text: 'Time (s)', font: { size: 11, color: '#90CAF9' } } },
                    yaxis: { ...MOTORSENSE_SCREEN_LAYOUT.yaxis, title: { text: 'Current (A)', font: { size: 11, color: '#90CAF9' } } },
                  }}
                  config={{ responsive: true, displayModeBar: true, displaylogo: false }}
                  style={{ width: '100%' }}
                  useResizeHandler
                />
              </div>

              {/* STAGE 2: Resampled Signal */}
              <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '4px', padding: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', padding: '0 4px' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#00E5FF' }}>
                    STAGE 02: RESAMPLED SIGNAL (UNIFORM TIME GRID)
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64B5F6' }}>
                    fs = {params.fs?.toLocaleString()} Hz
                  </span>
                </div>
                <Plot
                  data={[{
                    x: result.resampled?.t,
                    y: result.resampled?.x,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Resampled',
                    line: { color: '#80D8FF', width: 1.5 },
                  }]}
                  layout={{
                    ...MOTORSENSE_SCREEN_LAYOUT,
                    height: 200,
                    xaxis: { ...MOTORSENSE_SCREEN_LAYOUT.xaxis, title: { text: 'Time (s)', font: { size: 11, color: '#90CAF9' } } },
                    yaxis: { ...MOTORSENSE_SCREEN_LAYOUT.yaxis, title: { text: 'Current (A)', font: { size: 11, color: '#90CAF9' } } },
                  }}
                  config={{ responsive: true, displayModeBar: true, displaylogo: false }}
                  style={{ width: '100%' }}
                  useResizeHandler
                />
              </div>

              {/* STAGE 3: Hanning Window */}
              <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '4px', padding: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', padding: '0 4px' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#00E5FF' }}>
                    STAGE 03: HANNING WINDOW (SPECTRAL LEAKAGE SUPPRESSION)
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64B5F6' }}>
                    w(n) = 0.5 - 0.5·cos(2πn/N)
                  </span>
                </div>
                <Plot
                  data={[{
                    x: result.windowed?.t,
                    y: result.windowed?.x,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Windowed',
                    line: { color: '#B388FF', width: 1.5 },
                  }]}
                  layout={{
                    ...MOTORSENSE_SCREEN_LAYOUT,
                    height: 200,
                    xaxis: { ...MOTORSENSE_SCREEN_LAYOUT.xaxis, title: { text: 'Time (s)', font: { size: 11, color: '#90CAF9' } } },
                    yaxis: { ...MOTORSENSE_SCREEN_LAYOUT.yaxis, title: { text: 'Current (A)', font: { size: 11, color: '#90CAF9' } } },
                  }}
                  config={{ responsive: true, displayModeBar: true, displaylogo: false }}
                  style={{ width: '100%' }}
                  useResizeHandler
                />
              </div>

              {/* STAGE 4: Linear FFT */}
              <SpectrumChart
                title="STAGE 04: LINEAR AMPLITUDE SPECTRUM (FFT)"
                xFull={result.fft?.f}
                yFull={result.fft?.linear}
                xZoom={result.fft_zoom?.f}
                yZoom={result.fft_zoom?.linear}
                xLabel="Frequency (Hz)"
                yLabel="Amplitude (Arms)"
                traceName="FFT Linear"
                traceColor="#00E5FF"
                f_supply={f0}
                f_sb_lower={sbLo}
                f_sb_upper={sbHi}
                height={220}
              />

              {/* STAGE 5: High-Res dBFS Zoom */}
              <SpectrumChart
                title="STAGE 05: HIGH-RESOLUTION dBFS ZOOM (CARRIER &amp; FAULT SIDEBANDS)"
                xFull={result.fft?.f}
                yFull={result.fft?.dB}
                xZoom={result.fft_zoom?.f}
                yZoom={result.fft_zoom?.dB}
                xLabel="Frequency (Hz)"
                yLabel="Magnitude (dBFS)"
                traceName="Sidebands Zoom"
                traceColor="#FFB300"
                f_supply={f0}
                f_sb_lower={sbLo}
                f_sb_upper={sbHi}
                height={240}
              />

              {/* STAGE 6: Hilbert Demodulation Envelope */}
              <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '4px', padding: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', padding: '0 4px' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#00E5FF' }}>
                    STAGE 06: HILBERT TRANSFORM DEMODULATION ENVELOPE
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64B5F6' }}>
                    A(t) = |x(t) + j·H{x(t)}|
                  </span>
                </div>
                <Plot
                  data={[{
                    x: result.hilbert?.f,
                    y: result.hilbert?.dB,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'Envelope Spectrum',
                    line: { color: '#00E676', width: 1.5 },
                  }]}
                  layout={{
                    ...MOTORSENSE_SCREEN_LAYOUT,
                    height: 200,
                    xaxis: { ...MOTORSENSE_SCREEN_LAYOUT.xaxis, title: { text: 'Modulation Frequency (Hz)', font: { size: 11, color: '#90CAF9' } } },
                    yaxis: { ...MOTORSENSE_SCREEN_LAYOUT.yaxis, title: { text: 'Envelope dB', font: { size: 11, color: '#90CAF9' } } },
                  }}
                  config={{ responsive: true, displayModeBar: true, displaylogo: false }}
                  style={{ width: '100%' }}
                  useResizeHandler
                />
              </div>

              {/* STAGE 7: Welch PSD */}
              <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '4px', padding: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', padding: '0 4px' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#00E5FF' }}>
                    STAGE 07: WELCH POWER SPECTRAL DENSITY (PSD)
                  </span>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#64B5F6' }}>
                    WINDOW: Hanning · 50% OVERLAP
                  </span>
                </div>
                <Plot
                  data={[{
                    x: result.psd?.f,
                    y: result.psd?.psd,
                    type: 'scatter',
                    mode: 'lines',
                    name: 'PSD',
                    line: { color: '#FFD600', width: 1.5 },
                  }]}
                  layout={{
                    ...MOTORSENSE_SCREEN_LAYOUT,
                    height: 200,
                    xaxis: { ...MOTORSENSE_SCREEN_LAYOUT.xaxis, title: { text: 'Frequency (Hz)', font: { size: 11, color: '#90CAF9' } } },
                    yaxis: { ...MOTORSENSE_SCREEN_LAYOUT.yaxis, title: { text: 'Power (A²/Hz)', font: { size: 11, color: '#90CAF9' } } },
                  }}
                  config={{ responsive: true, displayModeBar: true, displaylogo: false }}
                  style={{ width: '100%' }}
                  useResizeHandler
                />
              </div>

              {/* Feature Table */}
              <FeatureTable
                features={result.features}
                sidebandInfo={result.sideband_info}
                thresholdDB={thr}
              />
            </div>
          )}
        </>
      )}

      {/* ISO 20958 Diagnostic Sheet Modal */}
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

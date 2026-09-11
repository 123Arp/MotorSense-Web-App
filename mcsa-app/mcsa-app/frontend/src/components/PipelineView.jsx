import { useState } from "react";
import axios from "axios";
import Plot from "react-plotly.js";
import FileUpload from "./FileUpload";
import SpectrumChart from "./SpectrumChart";
import VerdictBadge from "./VerdictBadge";
import FeatureTable from "./FeatureTable";
import { BASE_LAYOUT } from "./SpectrumChart";

function Warnings({ warnings }) {
  if (!warnings || warnings.length === 0) return null;
  return (
    <div style={{ marginBottom: "1rem" }}>
      {warnings.map((w, i) => (
        <div
          key={i}
          className={`banner ${w.severity === "ERROR" ? "banner-error" : "banner-warning"}`}
        >
          <span>{w.severity === "ERROR" ? "🚫" : "⚠"}</span>
          <div>
            <strong>{w.severity}:</strong> {w.message}
          </div>
        </div>
      ))}
    </div>
  );
}

function StageCard({ number, title, subtitle, children }) {
  return (
    <div className="card">
      <div className="card-header">
        <span className="stage-badge">{number}</span>
        <div>
          <div className="stage-title">{title}</div>
          {subtitle && <div className="stage-sub">{subtitle}</div>}
        </div>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

function TimeChart({ t, traces, title, height = 220 }) {
  if (!t || !traces) return null;
  const layout = {
    ...BASE_LAYOUT,
    height,
    xaxis: { ...BASE_LAYOUT.xaxis, title: { text: "Time (s)", font: { size: 11 } } },
    yaxis: { ...BASE_LAYOUT.yaxis, title: { text: "Amplitude (A)", font: { size: 11 } } },
  };
  return (
    <Plot
      data={traces}
      layout={layout}
      config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}

export default function PipelineView({ params, updateParam }) {
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [column, setColumn] = useState(params.column || "I1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [nSamples, setNSamples] = useState(null);

  const handleColumnsReady = (cols, _fname, f, n) => {
    setColumns(cols);
    setFile(f);
    setNSamples(n);
    setResult(null);
    setError(null);
  };

  const handleColumnChange = (col) => {
    setColumn(col);
    updateParam("column", col);
  };

  const runAnalysis = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append(
        "params",
        JSON.stringify({ ...params, column, fs: Number(params.fs) })
      );
      const res = await axios.post("/api/analyze", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 600_000,
      });
      setResult(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "Analysis failed");
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
    <div>
      {/* ── Upload + Run ───────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="stage-badge">↑</span>
          <div>
            <div className="stage-title">Load Signal File</div>
            <div className="stage-sub">Upload a .csv or .mat file (up to ~200 MB)</div>
          </div>
        </div>
        <div className="card-body">
          <FileUpload
            label=""
            onColumnsReady={handleColumnsReady}
            selectedColumn={column}
            onColumnChange={handleColumnChange}
          />
          {nSamples && (
            <div style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "0.5rem" }}>
              {nSamples.toLocaleString()} samples detected · {" "}
              {(nSamples / params.fs).toFixed(2)} s at {params.fs / 1000} kHz
            </div>
          )}
          {file && (
            <div style={{ marginTop: "1rem" }}>
              <button
                className="btn-primary"
                onClick={runAnalysis}
                disabled={loading}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {loading ? (
                  <>
                    <div className="spinner" />
                    Running DSP pipeline…
                  </>
                ) : (
                  "▶ Run Full MCSA Pipeline"
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="banner banner-error">
          <span>⚠</span>
          <strong>Error:</strong>&nbsp;{error}
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────── */}
      {result && (
        <>
          {/* Quality warnings */}
          <Warnings warnings={result.quality_check?.warnings} />

          {/* Stage 1: Raw signal */}
          <StageCard
            number="1"
            title="Raw Signal — Time Domain"
            subtitle={`First ${result.raw_signal?.display_window_ms} ms shown · ${result.raw_signal?.total_samples?.toLocaleString()} total samples used for DSP`}
          >
            <TimeChart
              t={result.raw_signal?.t}
              traces={[{
                x: result.raw_signal?.t,
                y: result.raw_signal?.x,
                type: "scatter", mode: "lines",
                name: `${column} (raw)`,
                line: { color: "#6B7280", width: 1 },
              }]}
              height={200}
            />
          </StageCard>

          {/* Stage 2: Filtered signal */}
          <StageCard
            number="2"
            title="Bandpass Filtered Signal"
            subtitle={`Butterworth order-${result.filtered_signal?.order} SOS filter · ${result.filtered_signal?.low_cut_hz}–${result.filtered_signal?.high_cut_hz} Hz passband`}
          >
            <TimeChart
              t={result.filtered_signal?.t}
              traces={[
                {
                  x: result.filtered_signal?.t,
                  y: result.filtered_signal?.raw,
                  type: "scatter", mode: "lines",
                  name: "Raw", opacity: 0.4,
                  line: { color: "#9CA3AF", width: 1 },
                },
                {
                  x: result.filtered_signal?.t,
                  y: result.filtered_signal?.filtered,
                  type: "scatter", mode: "lines",
                  name: "Filtered",
                  line: { color: "#1A56DB", width: 1.5 },
                },
              ]}
              height={200}
            />
          </StageCard>

          {/* Stage 3: FFT */}
          <StageCard
            number="3"
            title="FFT Amplitude Spectrum"
            subtitle={`Hann-windowed · Δf = ${result.fft?.freq_resolution_hz?.toFixed(4)} Hz · Sidebands at ${sbLo?.toFixed(3)} Hz and ${sbHi?.toFixed(3)} Hz`}
          >
            <SpectrumChart
              title=""
              xFull={result.fft?.freqs_full}
              yFull={result.fft?.mag_full}
              xZoom={result.fft?.freqs_zoom}
              yZoom={result.fft?.mag_zoom}
              xLabel="Frequency (Hz)"
              yLabel="Amplitude (A)"
              traceName={`FFT — ${column}`}
              traceColor="#1A56DB"
              f_supply={f0}
              f_sb_lower={sbLo}
              f_sb_upper={sbHi}
              height={260}
            />
          </StageCard>

          {/* Stage 4: Welch PSD */}
          <StageCard
            number="4"
            title="Welch Power Spectral Density"
            subtitle="Hann-windowed · 50% overlap · Lower variance than single FFT"
          >
            <SpectrumChart
              title=""
              xFull={result.welch_psd?.freqs_full}
              yFull={result.welch_psd?.psd_db_full}
              xZoom={result.welch_psd?.freqs_zoom}
              yZoom={result.welch_psd?.psd_db_zoom}
              xLabel="Frequency (Hz)"
              yLabel="PSD (dB/Hz)"
              traceName={`Welch PSD — ${column}`}
              traceColor="#7C3AED"
              f_supply={f0}
              f_sb_lower={sbLo}
              f_sb_upper={sbHi}
              height={260}
            />
          </StageCard>

          {/* Stage 5: Hilbert envelope */}
          <StageCard
            number="5"
            title="Hilbert Envelope Spectrum"
            subtitle={`Analytic signal → |envelope| → FFT · Shows AM modulation by mechanical faults · f_slip = ${sb?.f_slip_hz?.toFixed(3)} Hz`}
          >
            <SpectrumChart
              title=""
              xFull={result.hilbert_envelope?.freqs_full}
              yFull={result.hilbert_envelope?.mag_full}
              xZoom={result.hilbert_envelope?.freqs_zoom}
              yZoom={result.hilbert_envelope?.mag_zoom}
              xLabel="Frequency (Hz)"
              yLabel="Envelope Amplitude"
              traceName={`Envelope — ${column}`}
              traceColor="#D97706"
              f_supply={f0}
              f_sb_lower={sbLo}
              f_sb_upper={sbHi}
              defaultView="full"
              height={260}
            />
          </StageCard>

          {/* Stage 6: Feature extraction */}
          <StageCard
            number="6"
            title="Feature Extraction"
            subtitle="Sideband amplitudes measured from FFT spectrum and expressed in dB relative to fundamental"
          >
            <FeatureTable
              features={result.features}
              sidebandInfo={result.sideband_info}
              thresholdDB={thr}
            />
          </StageCard>

          {/* Stage 7: Verdict */}
          <StageCard
            number="7"
            title="Health Verdict"
            subtitle={`Threshold: ${thr} dB · Worst sideband vs threshold`}
          >
            <VerdictBadge verdict={result.verdict} />
            <div style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#9CA3AF" }}>
              Decision rule: if worst sideband level &gt; {thr} dB → FAULT LIKELY
            </div>
          </StageCard>
        </>
      )}

      {/* Placeholder when no analysis run yet */}
      {!result && !loading && !error && (
        <div
          style={{
            border: "2px dashed #E5E7EB",
            borderRadius: "6px",
            padding: "3rem",
            textAlign: "center",
            color: "#9CA3AF",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>📊</div>
          <div style={{ fontWeight: 600, color: "#374151" }}>
            Upload a file and run the pipeline to see results
          </div>
          <div style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
            All 7 DSP stages will appear here in sequence
          </div>
        </div>
      )}
    </div>
  );
}

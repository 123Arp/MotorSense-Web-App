import { useState } from "react";
import axios from "axios";
import Plot from "react-plotly.js";
import FileUpload from "./FileUpload";
import VerdictBadge from "./VerdictBadge";
import { BASE_LAYOUT } from "./SpectrumChart";

function OverlayChart({ title, xH, yH, xF, yF, xLabel, yLabel, f_supply, f_sb_lower, f_sb_upper, height = 280 }) {
  const shapes = f_supply
    ? [
        { type: "line", x0: f_supply, x1: f_supply, yref: "paper", y0: 0, y1: 1, line: { color: "#1A56DB", width: 1.5, dash: "solid" } },
        { type: "line", x0: f_sb_lower, x1: f_sb_lower, yref: "paper", y0: 0, y1: 1, line: { color: "#C81E1E", width: 1.5, dash: "dot" } },
        { type: "line", x0: f_sb_upper, x1: f_sb_upper, yref: "paper", y0: 0, y1: 1, line: { color: "#C81E1E", width: 1.5, dash: "dot" } },
      ]
    : [];

  const layout = {
    ...BASE_LAYOUT,
    height,
    shapes,
    xaxis: { ...BASE_LAYOUT.xaxis, title: { text: xLabel || "Frequency (Hz)", font: { size: 11 } } },
    yaxis: { ...BASE_LAYOUT.yaxis, title: { text: yLabel || "Amplitude", font: { size: 11 } } },
  };

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div className="card-header">
        <div className="stage-title">{title}</div>
        <div className="stage-sub" style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#9CA3AF" }}>
          <span style={{ color: "#057A55", fontWeight: 700 }}>■</span> Healthy &nbsp;
          <span style={{ color: "#C81E1E", fontWeight: 700 }}>■</span> Faulty &nbsp;
          <span style={{ color: "#1A56DB" }}>│</span> f₀ &nbsp;
          <span style={{ color: "#C81E1E" }}>┊</span> SB±
        </div>
      </div>
      <div className="card-body">
        <Plot
          data={[
            { x: xH, y: yH, type: "scatter", mode: "lines", name: "Healthy", line: { color: "#057A55", width: 1.5 } },
            { x: xF, y: yF, type: "scatter", mode: "lines", name: "Faulty", line: { color: "#C81E1E", width: 1.5 } },
          ]}
          layout={layout}
          config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
          style={{ width: "100%" }}
          useResizeHandler
        />
      </div>
    </div>
  );
}

function DeltaTable({ healthyFeatures, faultyFeatures, healthySB, faultySB, thr }) {
  if (!healthyFeatures || !faultyFeatures) return null;

  const rows = [
    {
      label: "Fundamental",
      hFreq: healthyFeatures.f_fundamental_hz,
      fFreq: faultyFeatures.f_fundamental_hz,
      hDB: 0,
      fDB: 0,
      delta: 0,
    },
    {
      label: "Lower Sideband (SB−)",
      hFreq: healthySB?.f_sb_lower_hz,
      fFreq: faultySB?.f_sb_lower_hz,
      hDB: healthyFeatures.L_lower_dB,
      fDB: faultyFeatures.L_lower_dB,
      delta: faultyFeatures.L_lower_dB - healthyFeatures.L_lower_dB,
    },
    {
      label: "Upper Sideband (SB+)",
      hFreq: healthySB?.f_sb_upper_hz,
      fFreq: faultySB?.f_sb_upper_hz,
      hDB: healthyFeatures.L_upper_dB,
      fDB: faultyFeatures.L_upper_dB,
      delta: faultyFeatures.L_upper_dB - healthyFeatures.L_upper_dB,
    },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div className="stage-title">Δ Sideband Level Comparison</div>
        <div className="stage-sub">Faulty − Healthy (positive Δ = elevated in faulty recording)</div>
      </div>
      <div className="card-body">
        <table className="feature-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Healthy (dB)</th>
              <th>Faulty (dB)</th>
              <th>Δ (dB)</th>
              <th>Fault Threshold</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td>{r.label}</td>
                <td className="mono-val ok-val">{r.hDB.toFixed(2)}</td>
                <td
                  className="mono-val"
                  style={{ color: r.fDB > thr ? "#C81E1E" : "#111928", fontWeight: r.fDB > thr ? 700 : 400 }}
                >
                  {r.fDB.toFixed(2)}
                </td>
                <td
                  className="mono-val"
                  style={{ color: r.delta > 0 ? "#C81E1E" : "#057A55", fontWeight: 700 }}
                >
                  {r.delta > 0 ? "+" : ""}{r.delta.toFixed(2)}
                </td>
                <td className="mono-val" style={{ color: "#9CA3AF" }}>{thr} dB</td>
                <td>
                  {r.label === "Fundamental" ? (
                    <span style={{ fontSize: "0.7rem", color: "#9CA3AF" }}>—</span>
                  ) : r.fDB > thr ? (
                    <span style={{ fontSize: "0.7rem", background: "#FDE8E8", color: "#C81E1E", padding: "0.15rem 0.45rem", borderRadius: "3px", fontWeight: 700 }}>ELEVATED</span>
                  ) : (
                    <span style={{ fontSize: "0.7rem", background: "#E3FBF2", color: "#057A55", padding: "0.15rem 0.45rem", borderRadius: "3px", fontWeight: 700 }}>NORMAL</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ComparisonView({ params }) {
  const [healthyFile, setHealthyFile] = useState(null);
  const [faultyFile, setFaultyFile] = useState(null);
  const [healthyCol, setHealthyCol] = useState("I1");
  const [faultyCol, setFaultyCol] = useState("I1");
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
      fd.append("healthy_file", healthyFile);
      fd.append("faulty_file", faultyFile);
      fd.append(
        "params",
        JSON.stringify({
          ...params,
          fs: Number(params.fs),
          healthy_column: healthyCol,
          faulty_column: faultyCol,
        })
      );
      const res = await axios.post("/api/compare", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 900_000,
      });
      setResults(res.data);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  const H = results?.healthy;
  const F = results?.faulty;
  const sb = H?.sideband_info;
  const f0 = sb?.f_supply_hz;
  const sbLo = sb?.f_sb_lower_hz;
  const sbHi = sb?.f_sb_upper_hz;
  const thr = params.threshold_dB ?? -40;

  return (
    <div>
      {/* Upload panels */}
      <div className="compare-uploads">
        <div className="card">
          <div className="card-header">
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#057A55" }}>◆ HEALTHY Recording</span>
          </div>
          <div className="card-body">
            <FileUpload
              label=""
              accent="#057A55"
              onColumnsReady={(_cols, _name, f) => { setHealthyFile(f); setResults(null); }}
              selectedColumn={healthyCol}
              onColumnChange={setHealthyCol}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#C81E1E" }}>◆ FAULTY Recording</span>
          </div>
          <div className="card-body">
            <FileUpload
              label=""
              accent="#C81E1E"
              onColumnsReady={(_cols, _name, f) => { setFaultyFile(f); setResults(null); }}
              selectedColumn={faultyCol}
              onColumnChange={setFaultyCol}
            />
          </div>
        </div>
      </div>

      <button
        className="btn-primary"
        onClick={runComparison}
        disabled={loading || !healthyFile || !faultyFile}
        style={{ width: "100%", justifyContent: "center", marginBottom: "1.25rem" }}
      >
        {loading ? (
          <>
            <div className="spinner" />
            Running comparison…
          </>
        ) : (
          "⚖ Run Healthy vs. Faulty Comparison"
        )}
      </button>

      {error && (
        <div className="banner banner-error">
          <span>⚠</span> {error}
        </div>
      )}

      {/* Results */}
      {results && (
        <>
          {/* Verdict row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.25rem" }}>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#057A55", textTransform: "uppercase", marginBottom: "0.4rem" }}>
                Healthy File: {H?.filename || ""}
              </div>
              <VerdictBadge verdict={H?.verdict} />
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#C81E1E", textTransform: "uppercase", marginBottom: "0.4rem" }}>
                Faulty File: {F?.filename || ""}
              </div>
              <VerdictBadge verdict={F?.verdict} />
            </div>
          </div>

          {/* Overlay FFT */}
          <OverlayChart
            title="FFT Amplitude Spectrum — Overlay (±50 Hz zoom)"
            xH={H?.fft?.freqs_zoom}
            yH={H?.fft?.mag_zoom}
            xF={F?.fft?.freqs_zoom}
            yF={F?.fft?.mag_zoom}
            xLabel="Frequency (Hz)"
            yLabel="Amplitude (A)"
            f_supply={f0}
            f_sb_lower={sbLo}
            f_sb_upper={sbHi}
          />

          {/* Overlay Welch */}
          <OverlayChart
            title="Welch PSD — Overlay (±50 Hz zoom)"
            xH={H?.welch_psd?.freqs_zoom}
            yH={H?.welch_psd?.psd_db_zoom}
            xF={F?.welch_psd?.freqs_zoom}
            yF={F?.welch_psd?.psd_db_zoom}
            xLabel="Frequency (Hz)"
            yLabel="PSD (dB/Hz)"
            f_supply={f0}
            f_sb_lower={sbLo}
            f_sb_upper={sbHi}
          />

          {/* Overlay Envelope */}
          <OverlayChart
            title="Hilbert Envelope Spectrum — Overlay"
            xH={H?.hilbert_envelope?.freqs_zoom}
            yH={H?.hilbert_envelope?.mag_zoom}
            xF={F?.hilbert_envelope?.freqs_zoom}
            yF={F?.hilbert_envelope?.mag_zoom}
            xLabel="Frequency (Hz)"
            yLabel="Envelope Amplitude"
            f_supply={f0}
            f_sb_lower={sbLo}
            f_sb_upper={sbHi}
          />

          {/* Delta table */}
          <DeltaTable
            healthyFeatures={H?.features}
            faultyFeatures={F?.features}
            healthySB={H?.sideband_info}
            faultySB={F?.sideband_info}
            thr={thr}
          />
        </>
      )}

      {!results && !loading && !error && (
        <div
          style={{
            border: "2px dashed #E5E7EB",
            borderRadius: "6px",
            padding: "3rem",
            textAlign: "center",
            color: "#9CA3AF",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>⚖</div>
          <div style={{ fontWeight: 600, color: "#374151" }}>
            Upload a healthy and a faulty recording, then run comparison
          </div>
          <div style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
            FFT, Welch PSD, and Envelope spectra will be overlaid on the same axes
          </div>
        </div>
      )}
    </div>
  );
}

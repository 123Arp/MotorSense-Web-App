export default function ParameterPanel({ params, updateParam }) {
  const num = (key, label, min, max, step, hint) => (
    <div className="param-group">
      <label className="param-label">{label}</label>
      <input
        className="param-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={params[key]}
        onChange={(e) => updateParam(key, parseFloat(e.target.value) || 0)}
      />
      {hint && <div style={{ fontSize: "0.7rem", color: "#9CA3AF", marginTop: "0.2rem" }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ padding: "1rem" }}>
      {/* ── Acquisition ─────────────────────────────────── */}
      <div className="sidebar-section-title">Acquisition</div>

      {num("fs", "Sampling Rate (Hz)", 1000, 200000, 1000, "Default: 50 000 Hz")}

      {/* ── Motor Parameters ────────────────────────────── */}
      <div className="sidebar-section-title">Motor Nameplate</div>

      {num("f_supply", "Supply Frequency (Hz)", 1, 400, 0.1, "50 Hz (EU) or 60 Hz (US)")}
      {num("rated_rpm", "Rated Speed (RPM)", 1, 100000, 10, "Motor nameplate speed")}
      {num("poles", "Pole Count", 2, 32, 2, "Even number: 2, 4, 6, 8…")}

      {/* ── Filter ──────────────────────────────────────── */}
      <div className="sidebar-section-title">Bandpass Filter</div>

      {num("low_cut", "Low Cutoff (Hz)", 0.1, 1000, 0.5, "Lower bound of passband")}
      {num("high_cut", "High Cutoff (Hz)", 10, 24900, 10, "Upper bound of passband")}
      {num("filter_order", "Filter Order", 1, 10, 1, "Butterworth order (4 recommended)")}

      {/* ── Fault Detection ──────────────────────────────── */}
      <div className="sidebar-section-title">Fault Detection</div>

      {num("threshold_dB", "Fault Threshold (dB)", -80, 0, 1, "Sideband level above this → FAULT")}

      {/* ── Calculated sideband preview ──────────────────── */}
      <div className="sidebar-section-title">Calculated Sidebands</div>
      <SidebandPreview params={params} />

      {/* ── About ────────────────────────────────────────── */}
      <div className="sidebar-section-title" style={{ marginTop: "1.5rem" }}>About the Data</div>
      <div style={{ fontSize: "0.72rem", color: "#6B7280", padding: "0 0.25rem", lineHeight: 1.5 }}>
        0.2 kW three-phase squirrel-cage induction motor. Vibration, voltage &amp; current
        synchronously sampled at 50 kHz. Fault scenarios: phase removal &amp; mechanical
        misalignment.
        <br /><br />
        <a
          href="https://www.nature.com/articles/s41597-025-05437-3"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#1A56DB" }}
        >
          Scientific Data (2025) ↗
        </a>
        &nbsp;·&nbsp;
        <a
          href="https://doi.org/10.6084/m9.figshare.27216219"
          target="_blank"
          rel="noreferrer"
          style={{ color: "#1A56DB" }}
        >
          Dataset ↗
        </a>
      </div>
    </div>
  );
}

function SidebandPreview({ params }) {
  const { f_supply, rated_rpm, poles } = params;
  if (!f_supply || !rated_rpm || !poles) return null;
  const Ns = 120 * f_supply / poles;
  const s = (Ns - rated_rpm) / Ns;
  const f_slip = Math.abs(s) * f_supply;
  const f_low = f_supply - 2 * f_slip;
  const f_up = f_supply + 2 * f_slip;

  const row = (label, val, unit) => (
    <tr key={label}>
      <td style={{ color: "#6B7280", paddingRight: "0.5rem", fontSize: "0.75rem" }}>{label}</td>
      <td style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", color: "#111928", textAlign: "right" }}>
        {val}
        <span style={{ color: "#9CA3AF", marginLeft: "0.25rem" }}>{unit}</span>
      </td>
    </tr>
  );

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        {row("Sync. Speed", Ns.toFixed(1), "RPM")}
        {row("Slip", (s * 100).toFixed(3), "%")}
        {row("f_slip", f_slip.toFixed(3), "Hz")}
        {row("Lower SB", f_low.toFixed(3), "Hz")}
        {row("Upper SB", f_up.toFixed(3), "Hz")}
      </tbody>
    </table>
  );
}

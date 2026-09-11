export default function FeatureTable({ features, sidebandInfo, thresholdDB }) {
  if (!features || !sidebandInfo) return null;
  const thr = thresholdDB ?? -40;

  const dbStyle = (val) => ({
    fontFamily: "JetBrains Mono, monospace",
    fontWeight: 700,
    color: val > thr ? "#C81E1E" : "#057A55",
  });

  const ampFmt = (v) => {
    if (v === undefined || v === null) return "—";
    if (v < 0.001) return v.toExponential(3);
    return v.toFixed(6);
  };

  return (
    <div>
      {/* Motor parameters used */}
      <div style={{ marginBottom: "0.75rem" }}>
        <div style={{ fontSize: "0.72rem", color: "#9CA3AF", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em", marginBottom: "0.35rem" }}>
          Slip Calculation
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
          <tbody>
            {[
              ["Synchronous Speed", sidebandInfo.Ns_rpm?.toFixed(1), "RPM"],
              ["Rotor Speed (rated)", sidebandInfo.Nr_rpm?.toFixed(1), "RPM"],
              ["Slip", sidebandInfo.slip_pct?.toFixed(3), "%"],
              ["Slip Frequency", sidebandInfo.f_slip_hz?.toFixed(4), "Hz"],
              ["Lower Sideband", sidebandInfo.f_sb_lower_hz?.toFixed(4), "Hz"],
              ["Upper Sideband", sidebandInfo.f_sb_upper_hz?.toFixed(4), "Hz"],
            ].map(([lbl, val, unit]) => (
              <tr key={lbl} style={{ borderBottom: "1px solid #F3F4F6" }}>
                <td style={{ padding: "0.3rem 0.5rem", color: "#6B7280" }}>{lbl}</td>
                <td style={{ padding: "0.3rem 0.5rem", fontFamily: "JetBrains Mono, monospace", textAlign: "right" }}>
                  {val} <span style={{ color: "#9CA3AF" }}>{unit}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sideband levels */}
      <div style={{ fontSize: "0.72rem", color: "#9CA3AF", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.06em", marginBottom: "0.35rem" }}>
        Extracted Sideband Features (FFT-based)
      </div>
      <table className="feature-table">
        <thead>
          <tr>
            <th>Component</th>
            <th>Nominal Freq (Hz)</th>
            <th>Measured Freq (Hz)</th>
            <th>Amplitude</th>
            <th>Level (dB rel. f₀)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Fundamental (f₀)</b></td>
            <td className="mono-val">{sidebandInfo.f_supply_hz?.toFixed(2)}</td>
            <td className="mono-val">{features.f_fundamental_hz?.toFixed(4)}</td>
            <td className="mono-val">{ampFmt(features.A_fundamental)}</td>
            <td className="mono-val">0.00 dB</td>
            <td><span style={{ color: "#1A56DB", fontWeight: 600, fontSize: "0.75rem" }}>REFERENCE</span></td>
          </tr>
          <tr>
            <td>Lower Sideband (SB−)</td>
            <td className="mono-val">{sidebandInfo.f_sb_lower_hz?.toFixed(4)}</td>
            <td className="mono-val">{features.f_lower_sb_hz?.toFixed(4)}</td>
            <td className="mono-val">{ampFmt(features.A_lower_sb)}</td>
            <td style={dbStyle(features.L_lower_dB)} className="mono-val">{features.L_lower_dB?.toFixed(2)} dB</td>
            <td>
              <SbStatus val={features.L_lower_dB} thr={thr} />
            </td>
          </tr>
          <tr>
            <td>Upper Sideband (SB+)</td>
            <td className="mono-val">{sidebandInfo.f_sb_upper_hz?.toFixed(4)}</td>
            <td className="mono-val">{features.f_upper_sb_hz?.toFixed(4)}</td>
            <td className="mono-val">{ampFmt(features.A_upper_sb)}</td>
            <td style={dbStyle(features.L_upper_dB)} className="mono-val">{features.L_upper_dB?.toFixed(2)} dB</td>
            <td>
              <SbStatus val={features.L_upper_dB} thr={thr} />
            </td>
          </tr>
          <tr style={{ background: "#F9FAFB", fontWeight: 700 }}>
            <td colSpan={4}>Worst sideband (decision variable)</td>
            <td style={dbStyle(features.worst_sideband_dB)} className="mono-val">
              {features.worst_sideband_dB?.toFixed(2)} dB
            </td>
            <td>
              <SbStatus val={features.worst_sideband_dB} thr={thr} />
            </td>
          </tr>
        </tbody>
      </table>
      <div style={{ fontSize: "0.72rem", color: "#9CA3AF", marginTop: "0.4rem" }}>
        Fault threshold: <span style={{ fontFamily: "JetBrains Mono, monospace" }}>{thr} dB</span>
        &nbsp;· L_dB = 20·log₁₀(A_sideband / A_fundamental)
      </div>
    </div>
  );
}

function SbStatus({ val, thr }) {
  const isFault = val > thr;
  return (
    <span
      style={{
        fontSize: "0.7rem",
        fontWeight: 700,
        padding: "0.15rem 0.45rem",
        borderRadius: "3px",
        background: isFault ? "#FDE8E8" : "#E3FBF2",
        color: isFault ? "#C81E1E" : "#057A55",
      }}
    >
      {isFault ? "ELEVATED" : "NORMAL"}
    </span>
  );
}

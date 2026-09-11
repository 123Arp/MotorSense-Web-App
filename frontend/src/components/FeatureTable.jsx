import React from 'react';

export default function FeatureTable({ features, sidebandInfo, thresholdDB }) {
  if (!features || !sidebandInfo) return null;
  const thr = thresholdDB ?? -40.0;

  const ampFmt = (v) => {
    if (v === undefined || v === null) return '—';
    if (v < 0.001) return v.toExponential(3);
    return v.toFixed(6);
  };

  const dbStyle = (val) => ({
    fontFamily: 'monospace',
    fontWeight: 700,
    color: val > thr ? '#C81E1E' : '#057A55',
  });

  return (
    <div>
      <table className="feature-table">
        <thead>
          <tr>
            <th>Spectral Component</th>
            <th>Target Freq (Hz)</th>
            <th>Peak Found (Hz)</th>
            <th>Measured Amplitude (A)</th>
            <th>Normalized dB (rel. f₀)</th>
            <th>Diagnostic Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ fontWeight: 600 }}>Fundamental Carrier (f₀)</td>
            <td className="mono-val">{sidebandInfo.f_supply_hz?.toFixed(2)}</td>
            <td className="mono-val">{features.f_fundamental_hz?.toFixed(4)}</td>
            <td className="mono-val">{ampFmt(features.A_fundamental)}</td>
            <td className="mono-val" style={{ fontWeight: 600, color: '#1A56DB' }}>0.00 dB</td>
            <td>
              <span style={{ fontSize: '10px', background: '#EBF0FF', color: '#1A56DB', padding: '2px 6px', borderRadius: '3px', fontWeight: 700 }}>
                CARRIER REFERENCE
              </span>
            </td>
          </tr>
          <tr>
            <td>Lower Fault Sideband (SB-)</td>
            <td className="mono-val">{sidebandInfo.f_sb_lower_hz?.toFixed(4)}</td>
            <td className="mono-val">{features.f_lower_sb_hz?.toFixed(4)}</td>
            <td className="mono-val">{ampFmt(features.A_lower_sb)}</td>
            <td style={dbStyle(features.L_lower_dB)} className="mono-val">
              {features.L_lower_dB?.toFixed(2)} dB
            </td>
            <td>
              <SidebandTag val={features.L_lower_dB} thr={thr} />
            </td>
          </tr>
          <tr>
            <td>Upper Fault Sideband (SB+)</td>
            <td className="mono-val">{sidebandInfo.f_sb_upper_hz?.toFixed(4)}</td>
            <td className="mono-val">{features.f_upper_sb_hz?.toFixed(4)}</td>
            <td className="mono-val">{ampFmt(features.A_upper_sb)}</td>
            <td style={dbStyle(features.L_upper_dB)} className="mono-val">
              {features.L_upper_dB?.toFixed(2)} dB
            </td>
            <td>
              <SidebandTag val={features.L_upper_dB} thr={thr} />
            </td>
          </tr>
          <tr style={{ background: '#F9FAFB', fontWeight: 'bold', borderTop: '2px solid #E5E7EB' }}>
            <td colSpan={4}>Worst-case Sideband (Health Metric)</td>
            <td style={{ ...dbStyle(features.worst_sideband_dB), fontSize: "13px" }} className="mono-val">
              {features.worst_sideband_dB?.toFixed(2)} dB
            </td>
            <td>
              <SidebandTag val={features.worst_sideband_dB} thr={thr} />
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: '8px', fontSize: '11px', color: '#6B7280', display: 'flex', justifyContent: 'space-between' }}>
        <span>Fault Threshold: <code style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#374151' }}>{thr} dB</code></span>
        <span>Relative Level: L_dB = 20·log₁₀(A_sideband / A_fundamental)</span>
      </div>
    </div>
  );
}

function SidebandTag({ val, thr }) {
  const isElevated = val > thr;
  return (
    <span
      style={{
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '3px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        background: isElevated ? '#FDE8E8' : '#E3FBF2',
        color: isElevated ? '#C81E1E' : '#057A55',
      }}
    >
      {isElevated ? 'ELEVATED' : 'NORMAL'}
    </span>
  );
}

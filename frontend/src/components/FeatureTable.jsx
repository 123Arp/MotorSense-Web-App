import React from 'react';

export default function FeatureTable({ features, sidebandInfo, thresholdDB }) {
  if (!features || !sidebandInfo) return null;
  const thr = thresholdDB ?? -40.0;

  const ampFmt = (v) => {
    if (v === undefined || v === null) return '—';
    if (v < 0.001) return v.toExponential(4);
    return v.toFixed(6);
  };

  const dbStyle = (val) => ({
    fontFamily: 'monospace',
    fontWeight: 700,
    color: val > thr ? '#B91C1C' : '#15803D',
  });

  return (
    <div>
      <table className="inst-table">
        <thead>
          <tr>
            <th>Spectral Component</th>
            <th>Nominal Center (Hz)</th>
            <th>Detected Peak (Hz)</th>
            <th>Peak Amplitude (Arms)</th>
            <th>Normalized Magnitude (dBFS)</th>
            <th>ISO 20958 Evaluation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ fontWeight: 600 }}>Fundamental Carrier (f₀)</td>
            <td className="font-mono">{sidebandInfo.f_supply_hz?.toFixed(2)}</td>
            <td className="font-mono">{features.f_fundamental_hz?.toFixed(4)}</td>
            <td className="font-mono">{ampFmt(features.A_fundamental)}</td>
            <td className="font-mono" style={{ fontWeight: 700, color: '#0F4C81' }}>0.00 dBFS</td>
            <td>
              <span style={{ fontSize: '10px', background: '#F1F5F9', color: '#334155', padding: '2px 6px', borderRadius: '2px', fontFamily: 'monospace', fontWeight: 600 }}>
                CARRIER REF
              </span>
            </td>
          </tr>
          <tr>
            <td>Lower Pole-Pass Sideband (f₀ − 2sf₀)</td>
            <td className="font-mono">{sidebandInfo.f_sb_lower_hz?.toFixed(4)}</td>
            <td className="font-mono">{features.f_lower_sb_hz?.toFixed(4)}</td>
            <td className="font-mono">{ampFmt(features.A_lower_sb)}</td>
            <td style={dbStyle(features.L_lower_dB)} className="font-mono">
              {features.L_lower_dB?.toFixed(2)} dBFS
            </td>
            <td>
              <SidebandEvaluationTag val={features.L_lower_dB} thr={thr} />
            </td>
          </tr>
          <tr>
            <td>Upper Pole-Pass Sideband (f₀ + 2sf₀)</td>
            <td className="font-mono">{sidebandInfo.f_sb_upper_hz?.toFixed(4)}</td>
            <td className="font-mono">{features.f_upper_sb_hz?.toFixed(4)}</td>
            <td className="font-mono">{ampFmt(features.A_upper_sb)}</td>
            <td style={dbStyle(features.L_upper_dB)} className="font-mono">
              {features.L_upper_dB?.toFixed(2)} dBFS
            </td>
            <td>
              <SidebandEvaluationTag val={features.L_upper_dB} thr={thr} />
            </td>
          </tr>
          <tr style={{ background: '#F8FAFC', fontWeight: 'bold', borderTop: '2px solid #CBD5E1' }}>
            <td colSpan={4}>Critical Metric: Max Sideband Energy (L_max)</td>
            <td style={{ ...dbStyle(features.worst_sideband_dB), fontSize: "13px", fontWeight: 800 }} className="font-mono">
              {features.worst_sideband_dB?.toFixed(2)} dBFS
            </td>
            <td>
              <SidebandEvaluationTag val={features.worst_sideband_dB} thr={thr} />
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748B', display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace' }}>
        <span>Decision Threshold: <strong>{thr} dBFS</strong></span>
        <span>Relative Level Formula: L_dB = 20·log₁₀(A_sb / A_fund)</span>
      </div>
    </div>
  );
}

function SidebandEvaluationTag({ val, thr }) {
  const isAlarm = val > thr;
  return (
    <span
      style={{
        fontSize: '10px',
        padding: '2px 6px',
        borderRadius: '2px',
        fontWeight: 700,
        letterSpacing: '0.04em',
        fontFamily: 'monospace',
        background: isAlarm ? '#FEE2E2' : '#DCFCE7',
        color: isAlarm ? '#B91C1C' : '#15803D',
        border: `1px solid ${isAlarm ? '#FCA5A5' : '#86EFAC'}`,
      }}
    >
      {isAlarm ? 'ALARM (ELEVATED)' : 'NORMAL (COMPLIANT)'}
    </span>
  );
}

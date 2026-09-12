import React from 'react';

export default function FeatureTable({ features, sidebandInfo, thresholdDB }) {
  if (!features || !sidebandInfo) return null;
  const thr = thresholdDB ?? -40.0;

  const ampFmt = (v) => {
    if (v === undefined || v === null) return '—';
    if (v < 0.001) return v.toExponential(4);
    return v.toFixed(6);
  };

  return (
    <div style={{ background: '#090D16', border: '1px solid #1F2C42', borderRadius: '4px', padding: '10px' }}>
      <div style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 800, color: '#64B5F6', marginBottom: '8px', letterSpacing: '0.04em' }}>
        MEASUREMENT CURSORS &amp; HARMONIC SIDEBAND SPECTRUM
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', fontFamily: 'monospace' }}>
        <thead>
          <tr style={{ background: '#101726', color: '#90CAF9', borderBottom: '1px solid #23314A' }}>
            <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '12px' }}>COMPONENT</th>
            <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '12px' }}>CALCULATED (Hz)</th>
            <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '12px' }}>PEAK DETECTED (Hz)</th>
            <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '12px' }}>AMPLITUDE (Arms)</th>
            <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '12px' }}>LEVEL (dBFS rel. f₀)</th>
            <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: '12px' }}>ISO STATUS</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #172236' }}>
            <td style={{ padding: '6px 8px', color: '#FFFFFF', fontWeight: 700 }}>Carrier Fundamental (f₀)</td>
            <td style={{ padding: '6px 8px', color: '#90CAF9' }}>{sidebandInfo.f_supply_hz?.toFixed(2)}</td>
            <td style={{ padding: '6px 8px', color: '#00E5FF' }}>{features.f_fundamental_hz?.toFixed(4)}</td>
            <td style={{ padding: '6px 8px', color: '#E0E6ED' }}>{ampFmt(features.A_fundamental)}</td>
            <td style={{ padding: '6px 8px', color: '#2979FF', fontWeight: 700 }}>0.00 dBFS</td>
            <td style={{ padding: '6px 8px' }}>
              <span style={{ fontSize: '11px', background: '#0D2B4A', color: '#40C4FF', padding: '2px 6px', borderRadius: '3px', border: '1px solid #0288D1' }}>
                REF CARRIER
              </span>
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #172236' }}>
            <td style={{ padding: '6px 8px', color: '#FF8A80' }}>Lower Pole-Pass Sideband (SB-)</td>
            <td style={{ padding: '6px 8px', color: '#90CAF9' }}>{sidebandInfo.f_sb_lower_hz?.toFixed(4)}</td>
            <td style={{ padding: '6px 8px', color: '#00E5FF' }}>{features.f_lower_sb_hz?.toFixed(4)}</td>
            <td style={{ padding: '6px 8px', color: '#E0E6ED' }}>{ampFmt(features.A_lower_sb)}</td>
            <td style={{ padding: '6px 8px', fontWeight: 800, color: features.L_lower_dB > thr ? '#FF1744' : '#00E676' }}>
              {features.L_lower_dB?.toFixed(2)} dBFS
            </td>
            <td style={{ padding: '6px 8px' }}>
              <StatusTag isAlarm={features.L_lower_dB > thr} />
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #172236' }}>
            <td style={{ padding: '6px 8px', color: '#FF8A80' }}>Upper Pole-Pass Sideband (SB+)</td>
            <td style={{ padding: '6px 8px', color: '#90CAF9' }}>{sidebandInfo.f_sb_upper_hz?.toFixed(4)}</td>
            <td style={{ padding: '6px 8px', color: '#00E5FF' }}>{features.f_upper_sb_hz?.toFixed(4)}</td>
            <td style={{ padding: '6px 8px', color: '#E0E6ED' }}>{ampFmt(features.A_upper_sb)}</td>
            <td style={{ padding: '6px 8px', fontWeight: 800, color: features.L_upper_dB > thr ? '#FF1744' : '#00E676' }}>
              {features.L_upper_dB?.toFixed(2)} dBFS
            </td>
            <td style={{ padding: '6px 8px' }}>
              <StatusTag isAlarm={features.L_upper_dB > thr} />
            </td>
          </tr>
          <tr style={{ background: '#11192A', fontWeight: 800 }}>
            <td colSpan={4} style={{ padding: '8px', color: '#E2E8F0', fontSize: '13px' }}>Max Sideband Level (Decision Metric ΔdBFS)</td>
            <td style={{ padding: '8px', fontSize: '14px', fontWeight: 800, color: features.worst_sideband_dB > thr ? '#FF1744' : '#00E676' }}>
              {features.worst_sideband_dB?.toFixed(2)} dBFS
            </td>
            <td style={{ padding: '8px' }}>
              <StatusTag isAlarm={features.worst_sideband_dB > thr} />
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
        <span>ALARM THRESHOLD: {thr} dBFS</span>
        <span>FORMULA: 20 · log₁₀(A_sideband / A_fundamental)</span>
      </div>
    </div>
  );
}

function StatusTag({ isAlarm }) {
  return (
    <span style={{
      fontSize: '11px',
      padding: '2px 8px',
      borderRadius: '3px',
      fontWeight: 800,
      background: isAlarm ? '#4D0A14' : '#0A3B22',
      color: isAlarm ? '#FF5252' : '#69F0AE',
      border: `1px solid ${isAlarm ? '#FF1744' : '#00E676'}`
    }}>
      {isAlarm ? 'ALARM LEVEL' : 'NORMAL'}
    </span>
  );
}

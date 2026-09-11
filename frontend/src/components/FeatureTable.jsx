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
    <div style={{ background: '#090D16', border: '1px solid #1F2C42', borderRadius: '2px', padding: '6px' }}>
      <div style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#64B5F6', marginBottom: '4px', letterSpacing: '0.04em' }}>
        MEASUREMENT CURSORS &amp; HARMONIC SIDEBAND SPECTRUM
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', fontFamily: 'monospace' }}>
        <thead>
          <tr style={{ background: '#101726', color: '#90CAF9', borderBottom: '1px solid #23314A' }}>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px' }}>COMPONENT</th>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px' }}>CALCULATED (Hz)</th>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px' }}>PEAK MEASURED (Hz)</th>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px' }}>AMPLITUDE (Arms)</th>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px' }}>LEVEL (dBFS rel. f₀)</th>
            <th style={{ textAlign: 'left', padding: '4px 6px', fontSize: '9px' }}>STATUS</th>
          </tr>
        </thead>
        <tbody>
          <tr style={{ borderBottom: '1px solid #172236' }}>
            <td style={{ padding: '4px 6px', color: '#FFFFFF', fontWeight: 700 }}>Carrier (f₀)</td>
            <td style={{ padding: '4px 6px', color: '#90CAF9' }}>{sidebandInfo.f_supply_hz?.toFixed(2)}</td>
            <td style={{ padding: '4px 6px', color: '#00E5FF' }}>{features.f_fundamental_hz?.toFixed(4)}</td>
            <td style={{ padding: '4px 6px', color: '#E0E6ED' }}>{ampFmt(features.A_fundamental)}</td>
            <td style={{ padding: '4px 6px', color: '#2979FF', fontWeight: 700 }}>0.00 dBFS</td>
            <td style={{ padding: '4px 6px' }}>
              <span style={{ fontSize: '9px', background: '#0D2B4A', color: '#40C4FF', padding: '1px 5px', borderRadius: '2px', border: '1px solid #0288D1' }}>
                REF CARRIER
              </span>
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #172236' }}>
            <td style={{ padding: '4px 6px', color: '#FF8A80' }}>Lower Pole-Pass (SB-)</td>
            <td style={{ padding: '4px 6px', color: '#90CAF9' }}>{sidebandInfo.f_sb_lower_hz?.toFixed(4)}</td>
            <td style={{ padding: '4px 6px', color: '#00E5FF' }}>{features.f_lower_sb_hz?.toFixed(4)}</td>
            <td style={{ padding: '4px 6px', color: '#E0E6ED' }}>{ampFmt(features.A_lower_sb)}</td>
            <td style={{ padding: '4px 6px', fontWeight: 700, color: features.L_lower_dB > thr ? '#FF1744' : '#00E676' }}>
              {features.L_lower_dB?.toFixed(2)} dBFS
            </td>
            <td style={{ padding: '4px 6px' }}>
              <M1kTag isAlarm={features.L_lower_dB > thr} />
            </td>
          </tr>
          <tr style={{ borderBottom: '1px solid #172236' }}>
            <td style={{ padding: '4px 6px', color: '#FF8A80' }}>Upper Pole-Pass (SB+)</td>
            <td style={{ padding: '4px 6px', color: '#90CAF9' }}>{sidebandInfo.f_sb_upper_hz?.toFixed(4)}</td>
            <td style={{ padding: '4px 6px', color: '#00E5FF' }}>{features.f_upper_sb_hz?.toFixed(4)}</td>
            <td style={{ padding: '4px 6px', color: '#E0E6ED' }}>{ampFmt(features.A_upper_sb)}</td>
            <td style={{ padding: '4px 6px', fontWeight: 700, color: features.L_upper_dB > thr ? '#FF1744' : '#00E676' }}>
              {features.L_upper_dB?.toFixed(2)} dBFS
            </td>
            <td style={{ padding: '4px 6px' }}>
              <M1kTag isAlarm={features.L_upper_dB > thr} />
            </td>
          </tr>
          <tr style={{ background: '#11192A', fontWeight: 800 }}>
            <td colSpan={4} style={{ padding: '4px 6px', color: '#E2E8F0' }}>Max Sideband Level (Decision Variable)</td>
            <td style={{ padding: '4px 6px', fontSize: '12px', fontWeight: 800, color: features.worst_sideband_dB > thr ? '#FF1744' : '#00E676' }}>
              {features.worst_sideband_dB?.toFixed(2)} dBFS
            </td>
            <td style={{ padding: '4px 6px' }}>
              <M1kTag isAlarm={features.worst_sideband_dB > thr} />
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '9px', color: '#64748B', fontFamily: 'monospace' }}>
        <span>ALARM THRESHOLD: {thr} dBFS</span>
        <span>LEVEL FORMULA: 20·log₁₀(A_sb / A_fund)</span>
      </div>
    </div>
  );
}

function M1kTag({ isAlarm }) {
  return (
    <span style={{
      fontSize: '9px',
      padding: '1px 5px',
      borderRadius: '2px',
      fontWeight: 700,
      background: isAlarm ? '#4D0A14' : '#0A3B22',
      color: isAlarm ? '#FF5252' : '#69F0AE',
      border: `1px solid ${isAlarm ? '#FF1744' : '#00E676'}`
    }}>
      {isAlarm ? 'ALARM LEVEL' : 'NORMAL'}
    </span>
  );
}

import React from 'react';

export default function ParameterPanel({ params, updateParam }) {
  const renderNumberInput = (key, label, min, max, step, unit, hint) => (
    <div className="param-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
        <label className="param-label" style={{ marginBottom: 0 }}>{label}</label>
        {unit && <span style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'monospace' }}>{unit}</span>}
      </div>
      <input
        className="param-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={params[key]}
        onChange={(e) => updateParam(key, parseFloat(e.target.value) || 0)}
      />
      {hint && <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ padding: '1rem', color: '#1F2937' }}>
      <div className="sidebar-section-title">Data Acquisition</div>
      {renderNumberInput('fs', 'Sampling Rate', 1000, 200000, 1000, 'Hz', 'Dataset rate: 50 000 Hz')}

      <div className="sidebar-section-title">Motor Nameplate</div>
      {renderNumberInput('f_supply', 'Supply Frequency', 1, 400, 0.5, 'Hz', '50.0 Hz (EU) / 60.0 Hz (US)')}
      {renderNumberInput('rated_rpm', 'Rated Speed', 1, 30000, 10, 'RPM', 'Nameplate full-load speed')}
      {renderNumberInput('poles', 'Pole Count', 2, 32, 2, 'P', 'Number of magnetic poles')}

      <div className="sidebar-section-title">Bandpass Filter (SOS)</div>
      {renderNumberInput('low_cut', 'Low Cutoff', 0.1, 1000, 0.5, 'Hz', 'High-pass corner')}
      {renderNumberInput('high_cut', 'High Cutoff', 10, 24000, 10, 'Hz', 'Low-pass corner')}
      {renderNumberInput('filter_order', 'Filter Order', 1, 10, 1, '', 'Butterworth order (SOS form)')}

      <div className="sidebar-section-title">Diagnostic Threshold</div>
      {renderNumberInput('threshold_dB', 'Fault Threshold', -80, 0, 1, 'dB', 'Default: -40 dB relative to carrier')}

      <div className="sidebar-section-title">Kinematic Calculation</div>
      <KinematicPreview params={params} />

      <div className="sidebar-section-title" style={{ marginTop: '1.5rem' }}>About the Data</div>
      <div style={{ fontSize: '11px', color: '#4B5563', lineHeight: 1.5, padding: '0 2px' }}>
        <p style={{ marginBottom: '8px' }}>
          Data collected from a <strong>0.2 kW three-phase squirrel-cage induction motor</strong>.
          Vibration (x, y, Z), current (I1, I2, I3), and voltage (V1, V2, V3) all synchronously sampled at <strong>50 kHz</strong>.
        </p>
        <p style={{ marginBottom: '8px' }}>
          Fault scenarios include phase removal and mechanical misalignment across healthy and faulty states.
        </p>
        <div>
          <a
            href="https://www.nature.com/articles/s41597-025-05437-3"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#1A56DB', display: 'block', marginBottom: '4px', textDecoration: 'none' }}
          >
            Nature Scientific Data (2025) ↗
          </a>
          <a
            href="https://doi.org/10.6084/m9.figshare.27216219"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#1A56DB', display: 'block', textDecoration: 'none' }}
          >
            Figshare Dataset DOI ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function KinematicPreview({ params }) {
  const { f_supply, rated_rpm, poles } = params;
  if (!f_supply || !rated_rpm || !poles) return null;

  const Ns = (120 * f_supply) / poles;
  const s = (Ns - rated_rpm) / Ns;
  const f_slip = Math.abs(s) * f_supply;
  const f_low = f_supply - 2 * f_slip;
  const f_up = f_supply + 2 * f_slip;

  const items = [
    { label: 'Sync Speed (Ns)', val: Ns.toFixed(1), unit: 'RPM' },
    { label: 'Slip (s)', val: (s * 100).toFixed(3), unit: '%' },
    { label: 'Slip Freq (f_slip)', val: f_slip.toFixed(3), unit: 'Hz' },
    { label: 'Lower SB (f - 2sf)', val: f_low.toFixed(3), unit: 'Hz' },
    { label: 'Upper SB (f + 2sf)', val: f_up.toFixed(3), unit: 'Hz' },
  ];

  return (
    <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '4px', padding: '8px', fontSize: '11px' }}>
      <table style={{ width: '100%' }}>
        <tbody>
          {items.map((it) => (
            <tr key={it.label} style={{ borderBottom: '1px solid #F3F4F6' }}>
              <td style={{ padding: '2px 0', color: '#6B7280' }}>{it.label}</td>
              <td style={{ padding: '2px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600, color: '#111928' }}>
                {it.val} <span style={{ fontSize: '9px', color: '#9CA3AF' }}>{it.unit}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

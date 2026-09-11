import React from 'react';
import { CpuIcon } from './Icons';

export default function ParameterPanel({ params, updateParam }) {
  const renderNumberInput = (key, label, min, max, step, unit, hint) => (
    <div className="inst-form-group">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
        <label className="inst-label" style={{ marginBottom: 0 }}>{label}</label>
        {unit && <span style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace' }}>[{unit}]</span>}
      </div>
      <input
        className="inst-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={params[key]}
        onChange={(e) => updateParam(key, parseFloat(e.target.value) || 0)}
      />
      {hint && <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '2px' }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ padding: '14px', color: '#1E293B' }}>
      {/* Power & Acquisition */}
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px', marginBottom: '10px' }}>
        ACQUISITION & POWER
      </div>
      {renderNumberInput('fs', 'Sampling Rate', 1000, 200000, 1000, 'Hz', 'Dataset clock: 50 000 Hz')}
      {renderNumberInput('f_supply', 'Supply Fundamental (f₀)', 1, 400, 0.1, 'Hz', '50.0 Hz (EU/Asia) / 60.0 Hz (US)')}

      {/* Motor Nameplate Specifications */}
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px', margin: '14px 0 10px 0' }}>
        MOTOR NAMEPLATE DATA
      </div>
      {renderNumberInput('rated_rpm', 'Rated Full-Load Speed', 1, 30000, 5, 'RPM', 'Nameplate operating speed')}
      {renderNumberInput('poles', 'Magnetic Pole Count (2p)', 2, 32, 2, 'P', 'Number of stator poles (e.g. 4)')}

      {/* DSP Filtering Specifications */}
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px', margin: '14px 0 10px 0' }}>
        DIGITAL FILTER (SOS BUTTERWORTH)
      </div>
      {renderNumberInput('low_cut', 'High-Pass Cutoff', 0.1, 1000, 0.5, 'Hz', 'Attenuates DC offset & drift')}
      {renderNumberInput('high_cut', 'Low-Pass Cutoff', 10, 24000, 10, 'Hz', 'Anti-aliasing cutoff boundary')}
      {renderNumberInput('filter_order', 'Filter Order (Cascaded SOS)', 1, 10, 1, 'N', 'Numerically stable SOS stages')}

      {/* Diagnostic Threshold */}
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px', margin: '14px 0 10px 0' }}>
        DIAGNOSTIC CRITERION (ISO 20958)
      </div>
      {renderNumberInput('threshold_dB', 'Fault Alarm Threshold', -80, 0, 1, 'dBFS', 'Normalized dB relative to carrier')}

      {/* Real-Time Kinematics Matrix */}
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px', margin: '14px 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <CpuIcon className="w-3.5 h-3.5 text-blue-700" />
        KINEMATIC TRACKING MATRIX
      </div>
      <KinematicMatrix params={params} />

      {/* About Dataset Citation */}
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748B', borderBottom: '1px solid #E2E8F0', paddingBottom: '4px', margin: '18px 0 8px 0' }}>
        ABOUT THE DATASET
      </div>
      <div style={{ fontSize: '11px', color: '#475569', lineHeight: 1.5, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '2px', padding: '8px' }}>
        <p style={{ margin: '0 0 6px 0' }}>
          0.2 kW 3-phase squirrel-cage induction machine. 9 synchronized channels (vibration <code>x,y,Z</code>, current <code>I1,I2,I3</code>, voltage <code>V1,V2,V3</code>) sampled at 50 kHz.
        </p>
        <div style={{ fontSize: '10px', color: '#64748B' }}>
          Citation: <em>Scientific Data</em> (Nature, 2025).<br />
          <a
            href="https://www.nature.com/articles/s41597-025-05437-3"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#0F4C81', fontWeight: 600, textDecoration: 'none', display: 'block', marginTop: '2px' }}
          >
            DOI: 10.1038/s41597-025-05437-3 ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function KinematicMatrix({ params }) {
  const { f_supply, rated_rpm, poles } = params;
  if (!f_supply || !rated_rpm || !poles) return null;

  const Ns = (120 * f_supply) / poles;
  const s = (Ns - rated_rpm) / Ns;
  const f_slip = Math.abs(s) * f_supply;
  const f_low = f_supply - 2 * f_slip;
  const f_up = f_supply + 2 * f_slip;

  const metrics = [
    { label: 'Sync Speed (Ns)', val: Ns.toFixed(1), unit: 'RPM' },
    { label: 'Per-Unit Slip (s)', val: (s * 100).toFixed(3), unit: '%' },
    { label: 'Slip Freq (f_slip)', val: f_slip.toFixed(3), unit: 'Hz' },
    { label: 'Lower Pole-Pass', val: f_low.toFixed(3), unit: 'Hz' },
    { label: 'Upper Pole-Pass', val: f_up.toFixed(3), unit: 'Hz' },
  ];

  return (
    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '2px', padding: '6px 8px', fontSize: '11px' }}>
      <table style={{ width: '100%' }}>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.label} style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '3px 0', color: '#64748B' }}>{m.label}</td>
              <td style={{ padding: '3px 0', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#0F172A' }}>
                {m.val} <span style={{ fontSize: '9px', color: '#94A3B8' }}>{m.unit}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

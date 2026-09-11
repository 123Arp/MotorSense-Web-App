import React from 'react';
import { SettingsIcon, CpuIcon } from './Icons';

export default function ParameterPanel({ params, updateParam }) {
  const renderNumberInput = (key, label, min, max, step, unit) => (
    <div style={{ marginBottom: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </span>
        {unit && <span style={{ fontSize: '9px', color: '#64748B', fontFamily: 'monospace' }}>[{unit}]</span>}
      </div>
      <input
        className="m1k-input"
        type="number"
        min={min}
        max={max}
        step={step}
        value={params[key]}
        onChange={(e) => updateParam(key, parseFloat(e.target.value) || 0)}
      />
    </div>
  );

  return (
    <div style={{ padding: '6px' }}>
      {/* Module 1: Timebase / Acquisition */}
      <div className="m1k-module">
        <div className="m1k-module-title">
          <span>TIMEBASE &amp; POWER</span>
          <span className="font-mono text-[9px] text-slate-600">ACQ_01</span>
        </div>
        <div className="m1k-module-body">
          {renderNumberInput('fs', 'Sample Rate (fs)', 1000, 200000, 1000, 'Hz')}
          {renderNumberInput('f_supply', 'Carrier (f₀)', 1, 400, 0.5, 'Hz')}
        </div>
      </div>

      {/* Module 2: Motor Nameplate */}
      <div className="m1k-module">
        <div className="m1k-module-title">
          <span>MOTOR NAMEPLATE</span>
          <span className="font-mono text-[9px] text-slate-600">DUT_SPEC</span>
        </div>
        <div className="m1k-module-body">
          {renderNumberInput('rated_rpm', 'Rated Speed (Nr)', 1, 30000, 10, 'RPM')}
          {renderNumberInput('poles', 'Poles (2p)', 2, 32, 2, 'P')}
        </div>
      </div>

      {/* Module 3: Math & Filter */}
      <div className="m1k-module">
        <div className="m1k-module-title">
          <span>FILTER (SOS BUTTERWORTH)</span>
          <span className="font-mono text-[9px] text-slate-600">DSP_FLT</span>
        </div>
        <div className="m1k-module-body">
          {renderNumberInput('low_cut', 'High-Pass Cutoff', 0.1, 1000, 0.5, 'Hz')}
          {renderNumberInput('high_cut', 'Low-Pass Cutoff', 10, 24000, 10, 'Hz')}
          {renderNumberInput('filter_order', 'Filter Order', 1, 10, 1, 'N')}
        </div>
      </div>

      {/* Module 4: Fault Discriminator */}
      <div className="m1k-module">
        <div className="m1k-module-title">
          <span>DIAGNOSTIC THRESHOLD</span>
          <span className="font-mono text-[9px] text-slate-600">ISO_20958</span>
        </div>
        <div className="m1k-module-body">
          {renderNumberInput('threshold_dB', 'Alarm Level', -80, 0, 1, 'dBFS')}
        </div>
      </div>

      {/* Module 5: Kinematic Calculator */}
      <div className="m1k-module">
        <div className="m1k-module-title">
          <span>CALCULATED KINEMATICS</span>
          <CpuIcon className="w-3 h-3 text-slate-700" />
        </div>
        <div className="m1k-module-body">
          <M1kKinematics params={params} />
        </div>
      </div>

      {/* Module 6: Hardware Info */}
      <div className="m1k-module" style={{ marginBottom: '10px' }}>
        <div className="m1k-module-title">
          <span>BENCHMARK DATASET</span>
        </div>
        <div className="m1k-module-body" style={{ fontSize: '10px', color: '#475569', lineHeight: 1.4 }}>
          <div>0.2 kW 3-Phase Induction Motor. 9 synchronous channels at 50 kHz.</div>
          <div style={{ marginTop: '4px' }}>
            <a
              href="https://www.nature.com/articles/s41597-025-05437-3"
              target="_blank"
              rel="noreferrer"
              style={{ color: '#005A9C', fontWeight: 700, textDecoration: 'none' }}
            >
              Nature Sci. Data (2025) ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function M1kKinematics({ params }) {
  const { f_supply, rated_rpm, poles } = params;
  if (!f_supply || !rated_rpm || !poles) return null;

  const Ns = (120 * f_supply) / poles;
  const s = (Ns - rated_rpm) / Ns;
  const f_slip = Math.abs(s) * f_supply;
  const f_low = f_supply - 2 * f_slip;
  const f_up = f_supply + 2 * f_slip;

  const rows = [
    ['Sync Speed (Ns)', `${Ns.toFixed(0)} RPM`],
    ['Slip Ratio (s)', `${(s * 100).toFixed(3)} %`],
    ['Slip Freq (fs)', `${f_slip.toFixed(3)} Hz`],
    ['Lower SB (f-2sf)', `${f_low.toFixed(3)} Hz`],
    ['Upper SB (f+2sf)', `${f_up.toFixed(3)} Hz`],
  ];

  return (
    <div>
      {rows.map(([lbl, val]) => (
        <div key={lbl} className="m1k-metric-row">
          <span className="m1k-metric-label">{lbl}</span>
          <span className="m1k-metric-value">{val}</span>
        </div>
      ))}
    </div>
  );
}

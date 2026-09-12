import React from 'react';
import { SettingsIcon, CpuIcon } from './Icons';

export default function ParameterPanel({ params, updateParam }) {
  const renderNumberInput = (key, label, min, max, step, unit) => (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
          {label}
        </span>
        {unit && <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>[{unit}]</span>}
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
          <span>TIMEBASE &amp; ACQUISITION</span>
          <span className="font-mono text-[11px] text-slate-600">ACQ_01</span>
        </div>
        <div className="m1k-module-body">
          {renderNumberInput('fs', 'Sampling Rate (fs)', 1000, 200000, 1000, 'Hz')}
          {renderNumberInput('f_supply', 'Supply Frequency (f₀)', 1, 400, 0.5, 'Hz')}
        </div>
      </div>

      {/* Module 2: Motor Nameplate */}
      <div className="m1k-module">
        <div className="m1k-module-title">
          <span>MOTOR NAMEPLATE</span>
          <span className="font-mono text-[11px] text-slate-600">DUT_SPEC</span>
        </div>
        <div className="m1k-module-body">
          {renderNumberInput('rated_rpm', 'Rated Speed (Nr)', 1, 30000, 10, 'RPM')}
          {renderNumberInput('poles', 'Stator Poles (2p)', 2, 32, 2, 'P')}
        </div>
      </div>

      {/* Module 3: Math & Filter */}
      <div className="m1k-module">
        <div className="m1k-module-title">
          <span>FILTER (SOS BUTTERWORTH)</span>
          <span className="font-mono text-[11px] text-slate-600">DSP_FLT</span>
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
          <span className="font-mono text-[11px] text-slate-600">ISO_20958</span>
        </div>
        <div className="m1k-module-body">
          {renderNumberInput('threshold_dB', 'Alarm Limit', -80, 0, 1, 'dBFS')}
        </div>
      </div>

      {/* Module 5: Kinematic Calculator */}
      <div className="m1k-module">
        <div className="m1k-module-title">
          <span>CALCULATED KINEMATICS</span>
          <CpuIcon className="w-3.5 h-3.5 text-slate-700" />
        </div>
        <div className="m1k-module-body">
          <KinematicsDisplay params={params} />
        </div>
      </div>

      {/* Module 6: Hardware Benchmark Info */}
      <div className="m1k-module" style={{ marginBottom: '10px' }}>
        <div className="m1k-module-title">
          <span>BENCHMARK MOTOR REFERENCE</span>
        </div>
        <div className="m1k-module-body" style={{ fontSize: '11px', color: '#475569', lineHeight: 1.5 }}>
          <div>0.2 kW 3-Phase Squirrel-Cage Induction Motor. 9 synchronous channels at 50 kS/s.</div>
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

function KinematicsDisplay({ params }) {
  const { f_supply, rated_rpm, poles } = params;
  if (!f_supply || !rated_rpm || !poles) return null;

  const Ns = (120 * f_supply) / poles;
  const s = (Ns - rated_rpm) / Ns;
  const f_slip = Math.abs(s) * f_supply;
  const f_low = f_supply - 2 * f_slip;
  const f_up = f_supply + 2 * f_slip;

  const rows = [
    ['Sync Speed (Ns)', `${Ns.toFixed(0)} RPM`],
    ['Slip Ratio (s)', `${(s * 100).toFixed(2)} %`],
    ['Slip Frequency (f_s)', `${f_slip.toFixed(2)} Hz`],
    ['Lower SB (f₀ - 2sf₀)', `${f_low.toFixed(2)} Hz`],
    ['Upper SB (f₀ + 2sf₀)', `${f_up.toFixed(2)} Hz`],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {rows.map(([label, val]) => (
        <div key={label} className="m1k-metric-row">
          <span className="m1k-metric-label" style={{ fontSize: '11px' }}>{label}</span>
          <span className="m1k-metric-value" style={{ fontSize: '11px' }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

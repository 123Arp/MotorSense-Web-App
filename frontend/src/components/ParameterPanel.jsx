import React from 'react';

function Field({ label, unit, children }) {
  return (
    <div className="ms-field">
      <div className="ms-field-row">
        <label className="ms-label" style={{ margin: 0 }}>{label}</label>
        {unit && <span className="ms-unit">{unit}</span>}
      </div>
      {children}
    </div>
  );
}

function NumInput({ paramKey, params, updateParam, min, max, step }) {
  return (
    <input
      type="number"
      className="ms-input"
      min={min} max={max} step={step}
      value={params[paramKey]}
      onChange={(e) => updateParam(paramKey, parseFloat(e.target.value) || 0)}
    />
  );
}

function KinematicsBlock({ params }) {
  const { f_supply, rated_rpm, poles } = params;
  if (!f_supply || !rated_rpm || !poles) return null;
  const Ns = (120 * f_supply) / poles;
  const s = (Ns - rated_rpm) / Ns;
  const f_slip = Math.abs(s) * f_supply;
  const rows = [
    ['Sync Speed', `${Ns.toFixed(0)} RPM`],
    ['Slip Ratio', `${(s * 100).toFixed(2)} %`],
    ['Slip Freq.', `${f_slip.toFixed(2)} Hz`],
    ['Lower SB', `${(f_supply - 2 * f_slip).toFixed(2)} Hz`],
    ['Upper SB', `${(f_supply + 2 * f_slip).toFixed(2)} Hz`],
  ];
  return (
    <div>
      {rows.map(([label, val]) => (
        <div key={label} className="ms-kine-row">
          <span className="ms-kine-label">{label}</span>
          <span className="ms-kine-value">{val}</span>
        </div>
      ))}
    </div>
  );
}

export default function ParameterPanel({ params, updateParam }) {
  return (
    <>
      <div className="ms-section-label">Acquisition</div>
      <div className="ms-card">
        <div className="ms-card-body">
          <Field label="Sampling Rate" unit="Hz">
            <NumInput paramKey="fs" params={params} updateParam={updateParam} min={1000} max={200000} step={1000} />
          </Field>
          <Field label="Supply Frequency" unit="Hz">
            <NumInput paramKey="f_supply" params={params} updateParam={updateParam} min={1} max={400} step={0.5} />
          </Field>
        </div>
      </div>

      <div className="ms-section-label">Motor Nameplate</div>
      <div className="ms-card">
        <div className="ms-card-body">
          <Field label="Rated Speed" unit="RPM">
            <NumInput paramKey="rated_rpm" params={params} updateParam={updateParam} min={1} max={30000} step={10} />
          </Field>
          <Field label="Poles" unit="P">
            <NumInput paramKey="poles" params={params} updateParam={updateParam} min={2} max={32} step={2} />
          </Field>
        </div>
      </div>

      <div className="ms-section-label">Bandpass Filter</div>
      <div className="ms-card">
        <div className="ms-card-body">
          <Field label="High-Pass Cutoff" unit="Hz">
            <NumInput paramKey="low_cut" params={params} updateParam={updateParam} min={0.1} max={1000} step={0.5} />
          </Field>
          <Field label="Low-Pass Cutoff" unit="Hz">
            <NumInput paramKey="high_cut" params={params} updateParam={updateParam} min={10} max={24000} step={10} />
          </Field>
          <Field label="Filter Order" unit="N">
            <NumInput paramKey="filter_order" params={params} updateParam={updateParam} min={1} max={10} step={1} />
          </Field>
        </div>
      </div>

      <div className="ms-section-label">Fault Threshold</div>
      <div className="ms-card">
        <div className="ms-card-body">
          <Field label="Sideband Alarm Level" unit="dBFS">
            <NumInput paramKey="threshold_dB" params={params} updateParam={updateParam} min={-80} max={0} step={1} />
          </Field>
        </div>
      </div>

      <div className="ms-section-label">Kinematics</div>
      <div className="ms-card">
        <div className="ms-card-body">
          <KinematicsBlock params={params} />
        </div>
      </div>

      <div className="ms-section-label">Dataset Reference</div>
      <div className="ms-card">
        <div className="ms-card-body">
          <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.6 }}>
            0.2 kW 3-Phase SCIM · 9 channels · 50 kS/s
          </p>
          <a
            href="https://www.nature.com/articles/s41597-025-05437-3"
            target="_blank" rel="noreferrer"
            style={{ fontSize: '12px', color: 'var(--accent-light)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}
          >
            Nature Sci. Data (2025)
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      </div>
    </>
  );
}

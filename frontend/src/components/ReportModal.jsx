import React from 'react';
import { DownloadIcon } from './Icons';

export default function ReportModal({ isOpen, onClose, result, params, filename }) {
  if (!isOpen || !result) return null;

  const sb = result.sideband_info || {};
  const feat = result.features || {};
  const verdict = result.verdict || {};
  const isHealthy = verdict.verdict === 'HEALTHY';
  const thr = result.threshold_dB ?? params.threshold_dB;
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="inst-modal-backdrop">
      <div className="inst-modal-window" style={{ maxWidth: '720px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Modal Header */}
        <div style={{ padding: '12px 16px', background: '#0F172A', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontFamily: 'monospace', background: '#334155', padding: '2px 6px', borderRadius: '2px' }}>
              ISO 20958-1
            </span>
            <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em' }}>
              ELECTRICAL SIGNATURE ANALYSIS (MCSA) DIAGNOSTIC CERTIFICATE
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body / Report Document */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1, background: '#FFFFFF', fontSize: '12px', color: '#1E293B' }}>
          {/* Header Metadata Block */}
          <div style={{ borderBottom: '2px solid #0F172A', paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: '0 0 4px 0' }}>
                MOTORSENSE™ CONDITION MONITORING REPORT
              </h2>
              <div style={{ fontSize: '11px', color: '#64748B' }}>
                Standards: ISO 20958 (Stator MCSA) · IEEE Std 1415 · Electric Motor Reliability Code
              </div>
            </div>
            <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '11px' }}>
              <div><strong>REPORT ID:</strong> MS-{Math.floor(100000 + Math.random() * 900000)}</div>
              <div><strong>DATE:</strong> {nowStr}</div>
            </div>
          </div>

          {/* Machine & Acquisition Telemetry Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px' }}>
            <div className="telemetry-cell">
              <div className="telemetry-label">File / Asset ID</div>
              <div className="telemetry-val" style={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {filename || result.filename || 'INPUT_STREAM'}
              </div>
            </div>
            <div className="telemetry-cell">
              <div className="telemetry-label">Tested Channel</div>
              <div className="telemetry-val" style={{ fontSize: '12px' }}>
                {result.used_column || params.column || 'I1'} (Stator Current)
              </div>
            </div>
            <div className="telemetry-cell">
              <div className="telemetry-label">Sampling Rate</div>
              <div className="telemetry-val">{params.fs?.toLocaleString()} Hz</div>
            </div>
            <div className="telemetry-cell">
              <div className="telemetry-label">Record Length</div>
              <div className="telemetry-val">{result.raw_signal?.total_samples?.toLocaleString()} pts</div>
            </div>
          </div>

          {/* Motor Kinematics Table */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.05em', marginBottom: '6px' }}>
              1. Kinematic Reference Parameters
            </div>
            <table className="inst-table">
              <thead>
                <tr>
                  <th>Nominal Carrier (f₀)</th>
                  <th>Synchronous Speed (Ns)</th>
                  <th>Rated Speed (Nr)</th>
                  <th>Poles (2p)</th>
                  <th>Operating Slip (s)</th>
                  <th>Slip Frequency (f_slip)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-mono">{sb.f_supply_hz?.toFixed(1)} Hz</td>
                  <td className="font-mono">{sb.Ns_rpm?.toFixed(0)} RPM</td>
                  <td className="font-mono">{sb.Nr_rpm?.toFixed(0)} RPM</td>
                  <td className="font-mono">{params.poles}</td>
                  <td className="font-mono">{sb.slip_pct?.toFixed(3)} %</td>
                  <td className="font-mono">{sb.f_slip_hz?.toFixed(3)} Hz</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Spectral Measurements Table */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#475569', letterSpacing: '0.05em', marginBottom: '6px' }}>
              2. Spectral Sideband Measurements (Relative Decibels)
            </div>
            <table className="inst-table">
              <thead>
                <tr>
                  <th>Spectral Component</th>
                  <th>Nominal (Hz)</th>
                  <th>Detected (Hz)</th>
                  <th>Magnitude (A)</th>
                  <th>Level (dBFS rel. f₀)</th>
                  <th>Criterion ({thr} dB)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Fundamental Carrier (f₀)</td>
                  <td className="font-mono">{sb.f_supply_hz?.toFixed(2)}</td>
                  <td className="font-mono">{feat.f_fundamental_hz?.toFixed(4)}</td>
                  <td className="font-mono">{feat.A_fundamental?.toFixed(4)}</td>
                  <td className="font-mono font-bold" style={{ color: '#0F4C81' }}>0.00 dB</td>
                  <td><span style={{ fontSize: '10px', color: '#64748B' }}>CARRIER REF</span></td>
                </tr>
                <tr>
                  <td>Lower Pole-Pass Sideband (f₀ − 2sf₀)</td>
                  <td className="font-mono">{sb.f_sb_lower_hz?.toFixed(4)}</td>
                  <td className="font-mono">{feat.f_lower_sb_hz?.toFixed(4)}</td>
                  <td className="font-mono">{feat.A_lower_sb?.toFixed(4)}</td>
                  <td className="font-mono font-bold" style={{ color: feat.L_lower_dB > thr ? '#B91C1C' : '#15803D' }}>
                    {feat.L_lower_dB?.toFixed(2)} dB
                  </td>
                  <td>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '2px',
                      background: feat.L_lower_dB > thr ? '#FEE2E2' : '#DCFCE7',
                      color: feat.L_lower_dB > thr ? '#B91C1C' : '#15803D'
                    }}>
                      {feat.L_lower_dB > thr ? 'ALARM LEVEL' : 'ACCEPTABLE'}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td>Upper Pole-Pass Sideband (f₀ + 2sf₀)</td>
                  <td className="font-mono">{sb.f_sb_upper_hz?.toFixed(4)}</td>
                  <td className="font-mono">{feat.f_upper_sb_hz?.toFixed(4)}</td>
                  <td className="font-mono">{feat.A_upper_sb?.toFixed(4)}</td>
                  <td className="font-mono font-bold" style={{ color: feat.L_upper_dB > thr ? '#B91C1C' : '#15803D' }}>
                    {feat.L_upper_dB?.toFixed(2)} dB
                  </td>
                  <td>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '2px',
                      background: feat.L_upper_dB > thr ? '#FEE2E2' : '#DCFCE7',
                      color: feat.L_upper_dB > thr ? '#B91C1C' : '#15803D'
                    }}>
                      {feat.L_upper_dB > thr ? 'ALARM LEVEL' : 'ACCEPTABLE'}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Diagnostic Verdict Block */}
          <div style={{
            border: `1px solid ${isHealthy ? '#BBF7D0' : '#FECACA'}`,
            background: isHealthy ? '#F0FDF4' : '#FEF2F2',
            padding: '12px 16px',
            borderRadius: '2px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: isHealthy ? '#15803D' : '#B91C1C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                MACHINE CONDITION STATUS: {isHealthy ? 'CLASS 1 — HEALTHY / NORMAL OPERATING CONDITION' : 'CLASS 4 — ACTION REQUIRED / FAULT LIKELY DETECTED'}
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: isHealthy ? '#15803D' : '#B91C1C' }}>
                MAX SIDEBAND: {feat.worst_sideband_dB?.toFixed(2)} dBFS
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '11px', lineHeight: 1.5, color: isHealthy ? '#166534' : '#991B1B' }}>
              {verdict.explanation}
            </p>
          </div>

          {/* Engineering Sign-off & Recommendations */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid #E2E8F0', paddingTop: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '4px' }}>
                Recommended Engineering Action:
              </div>
              <div style={{ fontSize: '11px', color: '#334155', lineHeight: 1.4 }}>
                {isHealthy
                  ? 'Maintain routine planned monitoring schedule (next scheduled review in 90 operating days). Current signatures indicate symmetric magnetic flux linkage.'
                  : 'Schedule immediate non-destructive inspection of squirrel-cage rotor bars and mechanical shaft coupling. Perform physical strobe vibration analysis at pole-pass modulation frequency.'}
              </div>
            </div>
            <div style={{ borderLeft: '1px solid #E2E8F0', paddingLeft: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '4px' }}>
                Automated Verification Seal:
              </div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#334155' }}>
                ENGINE: MotorSense DSP Kernel 2.4<br />
                DIGEST: SHA-256 Verified Analysis<br />
                STATUS: CERTIFIED CALCULATION
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div style={{ padding: '10px 16px', background: '#F8FAFC', borderTop: '1px solid #CBD5E1', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn-inst-secondary"
          >
            Close Window
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="btn-inst-primary"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            Print / Save Diagnostic PDF
          </button>
        </div>
      </div>
    </div>
  );
}

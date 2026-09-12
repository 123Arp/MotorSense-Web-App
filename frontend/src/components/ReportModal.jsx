import React, { useState } from 'react';

function generateReportHtml(result, params, filename) {
  if (!result) return '';
  const verdict = result.verdict?.verdict || '—';
  const sb = result.sideband_info || {};
  const f = result.features || {};
  const isHealthy = verdict === 'HEALTHY';
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const row = (label, val) => `<tr><td>${label}</td><td>${val ?? '—'}</td></tr>`;
  const fmtDb = (v) => v != null ? `${v.toFixed(2)} dBFS` : '—';
  const fmtHz = (v) => v != null ? `${v.toFixed(2)} Hz` : '—';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>MotorSense ISO 20958 Report — ${filename || 'Dataset'}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; max-width: 800px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 18px; color: #1d4ed8; border-bottom: 2px solid #1d4ed8; padding-bottom: 8px; margin-bottom: 4px; }
  h2 { font-size: 13px; color: #1e3a5f; margin: 16px 0 6px; }
  .meta { color: #555; font-size: 11px; margin-bottom: 16px; }
  .verdict { display: inline-block; padding: 4px 14px; border-radius: 4px; font-weight: 700; font-size: 15px;
    background: ${isHealthy ? '#dcfce7' : '#fee2e2'}; color: ${isHealthy ? '#15803d' : '#b91c1c'};
    border: 1px solid ${isHealthy ? '#86efac' : '#fca5a5'}; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #f1f5f9; text-align: left; padding: 6px 10px; font-size: 11px; color: #374151; border: 1px solid #e2e8f0; }
  td { padding: 5px 10px; border: 1px solid #e2e8f0; font-family: monospace; }
  tr:nth-child(even) td { background: #f9fafb; }
  .footer { margin-top: 20px; font-size: 10px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
  @media print { body { margin: 0; } }
</style>
</head><body>
<h1>MotorSense — ISO 20958 Diagnostic Report</h1>
<div class="meta">Generated: ${ts} · File: ${filename || '—'} · Channel: ${result.used_column || params.column}</div>

<h2>Verdict</h2>
<div class="verdict">${verdict}</div>
<p style="margin-top:8px;color:#374151">${result.verdict?.reason || '—'}</p>

<h2>Motor Parameters</h2>
<table><tr><th>Parameter</th><th>Value</th></tr>
${row('Sampling Rate (fs)', `${params.fs?.toLocaleString()} Hz`)}
${row('Supply Frequency (f₀)', `${params.f_supply} Hz`)}
${row('Rated Speed', `${params.rated_rpm} RPM`)}
${row('Poles', params.poles)}
${row('Filter Order', params.filter_order)}
${row('HP Cutoff', `${params.low_cut} Hz`)}
${row('LP Cutoff', `${params.high_cut} Hz`)}
${row('Threshold', `${params.threshold_dB} dBFS`)}
</table>

<h2>Sideband Frequencies</h2>
<table><tr><th>Parameter</th><th>Value</th></tr>
${row('Carrier f₀', fmtHz(sb.f_supply_hz))}
${row('Lower Sideband (f₀ − 2sf₀)', fmtHz(sb.f_sb_lower_hz))}
${row('Upper Sideband (f₀ + 2sf₀)', fmtHz(sb.f_sb_upper_hz))}
</table>

<h2>Diagnostic Features</h2>
<table><tr><th>Feature</th><th>Value</th></tr>
${row('Lower SB Amplitude', fmtDb(f.lower_sb_dBFS))}
${row('Upper SB Amplitude', fmtDb(f.upper_sb_dBFS))}
${row('Worst Sideband', fmtDb(f.worst_sideband_dB))}
${row('THD', f.thd != null ? `${(f.thd * 100).toFixed(3)} %` : '—')}
${row('RMS Current', f.rms_current != null ? `${f.rms_current.toFixed(4)} A` : '—')}
${row('SNR', f.snr_dB != null ? `${f.snr_dB.toFixed(2)} dB` : '—')}
${row('Kurtosis', f.kurtosis != null ? f.kurtosis.toFixed(4) : '—')}
${row('Crest Factor', f.crest_factor != null ? f.crest_factor.toFixed(3) : '—')}
${row('Dominant Frequency', fmtHz(f.dominant_freq_hz))}
</table>

<div class="footer">MotorSense v2.4 · ISO 20958-1 / IEEE Std 1415 · Motor Current Signature Analysis (MCSA) · DSP: NumPy/SciPy</div>
</body></html>`;
}

export default function ReportModal({ isOpen, onClose, result, params, filename }) {
  const [copied, setCopied] = useState(false);
  if (!isOpen) return null;

  const openPrint = () => {
    const html = generateReportHtml(result, params, filename);
    const w = window.open('', '_blank', 'width=860,height=700,scrollbars=yes');
    if (!w) { alert('Popup blocked. Please allow popups for this site.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  const downloadHtml = () => {
    const html = generateReportHtml(result, params, filename);
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `MotorSense_Report_${filename || 'data'}.html`;
    a.click();
  };

  const copySummary = () => {
    if (!result) return;
    const f = result.features || {};
    const text = [
      `MotorSense ISO 20958 Diagnostic Report`,
      `File: ${filename || '—'}  Channel: ${result.used_column || params.column}`,
      `Verdict: ${result.verdict?.verdict || '—'}`,
      `Reason: ${result.verdict?.reason || '—'}`,
      `Worst Sideband: ${f.worst_sideband_dB?.toFixed(2) ?? '—'} dBFS`,
      `RMS: ${f.rms_current?.toFixed(4) ?? '—'} A`,
      `THD: ${f.thd != null ? (f.thd * 100).toFixed(3) : '—'} %`,
      `Threshold: ${params.threshold_dB} dBFS`,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const v = result?.verdict;
  const isHealthy = v?.verdict === 'HEALTHY';

  return (
    <div className="ms-modal-bg" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ms-modal" style={{ maxWidth: '560px' }}>
        <div className="ms-modal-header">
          <span className="ms-modal-title">ISO 20958 Diagnostic Report</span>
          <button type="button" className="ms-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="ms-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Verdict */}
          <div className={isHealthy ? 'ms-verdict-healthy' : 'ms-verdict-faulty'} style={{ padding: '12px 14px' }}>
            <div className={`ms-verdict-icon ${isHealthy ? 'healthy' : 'faulty'}`}>{isHealthy ? 'OK' : '⚠'}</div>
            <div>
              <div className={`ms-verdict-title ${isHealthy ? 'healthy' : 'faulty'}`}>{v?.verdict || '—'}</div>
              <div className="ms-verdict-sub">{v?.reason || '—'}</div>
            </div>
          </div>

          {/* Quick stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            {[
              { label: 'Worst SB', val: result?.features?.worst_sideband_dB?.toFixed(1), unit: 'dBFS' },
              { label: 'RMS', val: result?.features?.rms_current?.toFixed(3), unit: 'A' },
              { label: 'Threshold', val: params.threshold_dB, unit: 'dBFS' },
            ].map(({ label, val, unit }) => (
              <div key={label} className="ms-stat-item">
                <div className="ms-stat-label">{label}</div>
                <div className="ms-stat-value" style={{ fontSize: '15px' }}>{val ?? '—'}<span className="ms-stat-unit">{unit}</span></div>
              </div>
            ))}
          </div>

          <div className="ms-alert ms-alert-info" style={{ fontSize: '12px' }}>
            The report contains full parameters, sideband frequencies, and all diagnostic features.
          </div>
        </div>

        <div className="ms-modal-footer">
          <button type="button" className="ms-btn ms-btn-sm" onClick={copySummary}>
            {copied ? 'OK Copied' : 'Copy Summary'}
          </button>
          <button type="button" className="ms-btn ms-btn-sm" onClick={downloadHtml}>
            Download HTML
          </button>
          <button type="button" className="ms-btn ms-btn-primary ms-btn-sm" onClick={openPrint}>
            Print Report
          </button>
        </div>
      </div>
    </div>
  );
}

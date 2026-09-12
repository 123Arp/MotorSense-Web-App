import React from 'react';

function Tag({ value, threshold }) {
  if (value == null) return <span className="ms-tag ms-tag-warn">N/A</span>;
  const isFault = threshold != null ? value > threshold : false;
  return (
    <span className={`ms-tag ${isFault ? 'ms-tag-fault' : 'ms-tag-ok'}`}>
      {isFault ? 'FAULT' : 'OK'}
    </span>
  );
}

export default function FeatureTable({ features, sidebandInfo, thresholdDB }) {
  if (!features) return null;
  const f = features;
  const sb = sidebandInfo || {};
  const thr = thresholdDB ?? -40;

  const rows = [
    { label: 'Carrier Frequency (f₀)',     val: sb.f_supply_hz != null ? `${sb.f_supply_hz.toFixed(2)} Hz` : '—', tag: null },
    { label: 'Lower Sideband (f₀ − 2sf₀)', val: sb.f_sb_lower_hz != null ? `${sb.f_sb_lower_hz.toFixed(2)} Hz` : '—', tag: null },
    { label: 'Upper Sideband (f₀ + 2sf₀)', val: sb.f_sb_upper_hz != null ? `${sb.f_sb_upper_hz.toFixed(2)} Hz` : '—', tag: null },
    { label: 'Lower SB Amplitude',          val: f.lower_sb_dBFS != null ? `${f.lower_sb_dBFS.toFixed(2)} dBFS` : '—', rawVal: f.lower_sb_dBFS, thr },
    { label: 'Upper SB Amplitude',          val: f.upper_sb_dBFS != null ? `${f.upper_sb_dBFS.toFixed(2)} dBFS` : '—', rawVal: f.upper_sb_dBFS, thr },
    { label: 'Worst Sideband',              val: f.worst_sideband_dB != null ? `${f.worst_sideband_dB.toFixed(2)} dBFS` : '—', rawVal: f.worst_sideband_dB, thr },
    { label: 'THD (Total Harmonic Dist.)',  val: f.thd != null ? `${(f.thd * 100).toFixed(3)} %` : '—', tag: null },
    { label: 'Dominant Frequency',          val: f.dominant_freq_hz != null ? `${f.dominant_freq_hz.toFixed(2)} Hz` : '—', tag: null },
    { label: 'Signal SNR',                  val: f.snr_dB != null ? `${f.snr_dB.toFixed(2)} dB` : '—', tag: null },
    { label: 'Kurtosis',                    val: f.kurtosis != null ? f.kurtosis.toFixed(4) : '—', tag: null },
    { label: 'RMS Current',                 val: f.rms_current != null ? `${f.rms_current.toFixed(4)} A` : '—', tag: null },
    { label: 'Crest Factor',                val: f.crest_factor != null ? f.crest_factor.toFixed(3) : '—', tag: null },
  ];

  return (
    <div className="ms-card">
      <div className="ms-card-header">
        <span className="ms-card-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          Diagnostic Features
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          Threshold: {thr} dBFS
        </span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="ms-ftable">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Value</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ label, val, rawVal, thr: rowThr, tag }) => (
              <tr key={label}>
                <td style={{ color: 'var(--text-2)', fontFamily: 'var(--font-sans)' }}>{label}</td>
                <td>{val}</td>
                <td>
                  {tag === null ? null : (
                    rowThr != null
                      ? <Tag value={rawVal} threshold={rowThr} />
                      : <span className="ms-tag ms-tag-warn">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

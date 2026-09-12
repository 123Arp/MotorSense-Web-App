import React from 'react';

export default function VerdictBadge({ verdict, thresholdDB }) {
  if (!verdict) return null;
  const isHealthy = verdict.verdict === 'HEALTHY';
  const conf = verdict.confidence_score ? `${(verdict.confidence_score * 100).toFixed(1)}%` : null;

  return (
    <div className={isHealthy ? 'ms-verdict-healthy' : 'ms-verdict-faulty'}>
      <div className={`ms-verdict-icon ${isHealthy ? 'healthy' : 'faulty'}`}>
        {isHealthy ? 'OK' : '⚠'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span className={`ms-verdict-title ${isHealthy ? 'healthy' : 'faulty'}`}>
            {verdict.verdict}
          </span>
          {conf && (
            <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '99px', background: isHealthy ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', color: isHealthy ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
              {conf} confidence
            </span>
          )}
        </div>
        <div className="ms-verdict-sub">
          {verdict.reason || (isHealthy ? 'No rotor bar fault signatures detected.' : 'Rotor bar fault sidebands detected.')}
        </div>
        {thresholdDB != null && (
          <div style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px', fontFamily: 'var(--font-mono)' }}>
            Threshold: {thresholdDB} dBFS
          </div>
        )}
      </div>
    </div>
  );
}

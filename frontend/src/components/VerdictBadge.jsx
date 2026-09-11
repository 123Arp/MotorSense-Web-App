import React from 'react';

export default function VerdictBadge({ verdict }) {
  if (!verdict) return null;
  const isHealthy = verdict.verdict === 'HEALTHY';

  return (
    <div className={isHealthy ? 'verdict-healthy' : 'verdict-fault'}>
      <div className="verdict-icon">
        {isHealthy ? '✓' : '⚠'}
      </div>
      <div>
        <div
          className="verdict-label"
          style={{ color: isHealthy ? '#057A55' : '#C81E1E' }}
        >
          {verdict.label}
        </div>
        <div
          className="verdict-explanation"
          style={{ color: isHealthy ? '#065F46' : '#9B1C1C' }}
        >
          {verdict.explanation}
        </div>
      </div>
    </div>
  );
}

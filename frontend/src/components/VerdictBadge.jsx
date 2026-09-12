import React from 'react';

export default function VerdictBadge({ verdict, thresholdDB }) {
  if (!verdict) return null;
  const isHealthy = verdict.verdict === 'HEALTHY';

  return (
    <div style={{
      background: '#0B101D',
      border: `1.5px solid ${isHealthy ? '#00E676' : '#FF1744'}`,
      borderRadius: '4px',
      padding: '12px 16px',
      color: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      boxShadow: `inset 0 0 16px ${isHealthy ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 23, 68, 0.15)'}`
    }}>
      {/* Annunciator LED Lamp */}
      <div style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        background: isHealthy ? '#00E676' : '#FF1744',
        boxShadow: isHealthy ? '0 0 12px #00E676, inset 0 0 4px #FFFFFF' : '0 0 12px #FF1744, inset 0 0 4px #FFFFFF',
        flexShrink: 0
      }} />

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{
            fontSize: '15px',
            fontFamily: 'monospace',
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: isHealthy ? '#00E676' : '#FF5252'
          }}>
            {isHealthy ? 'DIAGNOSTIC STATUS: NORMAL (HEALTHY MOTOR)' : 'DIAGNOSTIC STATUS: ALARM (FAULT ANOMALY LIKELY)'}
          </div>

          <span style={{
            fontFamily: 'monospace',
            fontSize: '12px',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: '3px',
            background: isHealthy ? '#004D25' : '#4D000E',
            border: `1px solid ${isHealthy ? '#00E676' : '#FF1744'}`,
            color: isHealthy ? '#69F0AE' : '#FF8A80'
          }}>
            {isHealthy ? 'ISO CLASS 1' : 'ISO CLASS 4'}
          </span>
        </div>

        <div style={{ fontSize: '13px', color: '#90CAF9', lineHeight: 1.5, fontFamily: 'monospace' }}>
          {verdict.explanation}
        </div>

        <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace', marginTop: '6px', display: 'flex', gap: '20px' }}>
          <span>STANDARD: <strong>ISO 20958 MCSA</strong></span>
          <span>CRITERION: <strong>{thresholdDB ?? -40} dBFS</strong></span>
          <span>EVALUATION: <strong>SPECTRAL MODULATION ENERGY</strong></span>
        </div>
      </div>
    </div>
  );
}

import React from 'react';

export default function VerdictBadge({ verdict, thresholdDB }) {
  if (!verdict) return null;
  const isHealthy = verdict.verdict === 'HEALTHY';

  return (
    <div style={{
      background: '#0B101D',
      border: `1px solid ${isHealthy ? '#00E676' : '#FF1744'}`,
      borderRadius: '2px',
      padding: '10px 14px',
      color: '#FFFFFF',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      boxShadow: `inset 0 0 12px ${isHealthy ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255, 23, 68, 0.15)'}`
    }}>
      {/* Annunciator LED Lamp */}
      <div style={{
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: isHealthy ? '#00E676' : '#FF1744',
        boxShadow: isHealthy ? '0 0 10px #00E676, inset 0 0 4px #FFFFFF' : '0 0 10px #FF1744, inset 0 0 4px #FFFFFF',
        flexShrink: 0
      }} />

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
          <div style={{
            fontSize: '13px',
            fontFamily: 'monospace',
            fontWeight: 800,
            letterSpacing: '0.05em',
            color: isHealthy ? '#00E676' : '#FF5252'
          }}>
            {isHealthy ? 'DIAGNOSTIC STATUS: NORMAL (HEALTHY MOTOR)' : 'DIAGNOSTIC STATUS: ALARM (FAULT ANOMALY LIKELY)'}
          </div>

          <span style={{
            fontFamily: 'monospace',
            fontSize: '10px',
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: '2px',
            background: isHealthy ? '#004D25' : '#4D000E',
            border: `1px solid ${isHealthy ? '#00E676' : '#FF1744'}`,
            color: isHealthy ? '#69F0AE' : '#FF8A80'
          }}>
            {isHealthy ? 'ISO CLASS 1' : 'ISO CLASS 4'}
          </span>
        </div>

        <div style={{ fontSize: '11px', color: '#90CAF9', lineHeight: 1.4, fontFamily: 'monospace' }}>
          {verdict.explanation}
        </div>

        <div style={{ fontSize: '10px', color: '#64748B', fontFamily: 'monospace', marginTop: '4px', display: 'flex', gap: '16px' }}>
          <span>STANDARD: ISO 20958 MCSA</span>
          <span>CRITERION: {thresholdDB ?? -40} dBFS</span>
          <span>EVALUATION: SPECTRAL MODULATION ENERGY</span>
        </div>
      </div>
    </div>
  );
}

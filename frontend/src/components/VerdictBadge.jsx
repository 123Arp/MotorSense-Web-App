import React from 'react';
import { ShieldCheckIcon, AlertTriangleIcon } from './Icons';

export default function VerdictBadge({ verdict, thresholdDB }) {
  if (!verdict) return null;
  const isHealthy = verdict.verdict === 'HEALTHY';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '14px',
      padding: '16px',
      borderRadius: '2px',
      border: `1px solid ${isHealthy ? '#BBF7D0' : '#FECACA'}`,
      background: isHealthy ? '#F0FDF4' : '#FEF2F2',
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '2px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isHealthy ? '#DCFCE7' : '#FEE2E2',
        flexShrink: 0,
        border: `1px solid ${isHealthy ? '#86EFAC' : '#FCA5A5'}`
      }}>
        {isHealthy ? (
          <ShieldCheckIcon className="w-5 h-5 text-green-700" />
        ) : (
          <AlertTriangleIcon className="w-5 h-5 text-red-700" />
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: isHealthy ? '#15803D' : '#B91C1C',
            textTransform: 'uppercase',
            fontFamily: 'monospace'
          }}>
            {isHealthy ? 'HEALTHY — NORMAL OPERATING PROFILE' : 'FAULT LIKELY — ANOMALY DETECTED'}
          </div>

          <div style={{
            fontSize: '10px',
            fontFamily: 'monospace',
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: '2px',
            background: isHealthy ? '#15803D' : '#B91C1C',
            color: '#FFFFFF'
          }}>
            {isHealthy ? 'CLASS 1 (NORMAL)' : 'CLASS 4 (ACTION)'}
          </div>
        </div>

        <p style={{
          margin: '0 0 6px 0',
          fontSize: '12px',
          lineHeight: 1.5,
          color: isHealthy ? '#166534' : '#991B1B'
        }}>
          {verdict.explanation}
        </p>

        <div style={{
          display: 'flex',
          gap: '16px',
          fontSize: '11px',
          color: isHealthy ? '#15803D' : '#B91C1C',
          fontFamily: 'monospace',
          borderTop: `1px dashed ${isHealthy ? '#86EFAC' : '#FCA5A5'}`,
          paddingTop: '6px'
        }}>
          <span>Standard: <strong>ISO 20958:2013</strong></span>
          <span>Decision Boundary: <strong>{thresholdDB ?? -40} dBFS</strong></span>
          <span>Classification: <strong>Electrical Signature Analysis (MCSA)</strong></span>
        </div>
      </div>
    </div>
  );
}

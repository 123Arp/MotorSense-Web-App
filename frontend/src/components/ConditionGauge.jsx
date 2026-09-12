import React from 'react';

const ZONES = [
  { label: 'Healthy',  color: '#22c55e', from: 0,   to: 33  },
  { label: 'Warning',  color: '#f59e0b', from: 33,  to: 66  },
  { label: 'Critical', color: '#ef4444', from: 66,  to: 100 },
];

export default function ConditionGauge({ worstDb, thresholdDb, isHealthy }) {
  const pct = worstDb == null ? 0 : Math.max(0, Math.min(100, ((worstDb - (-80)) / (0 - (-80))) * 100));
  const angle = -135 + pct * 2.7; // -135 to +135 degrees = 270 total
  const r = 48; const cx = 60; const cy = 64;

  const polarToXY = (deg, radius) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const arcPath = (startDeg, endDeg, radius) => {
    const s = polarToXY(startDeg, radius);
    const e = polarToXY(endDeg, radius);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  };

  const zoneColor = ZONES.find((z) => pct >= z.from && pct <= z.to)?.color || '#ef4444';

  const needle = polarToXY(angle, r - 8);

  return (
    <div className="ms-gauge-wrap">
      <svg viewBox="0 0 120 90" style={{ width: '100%', maxWidth: '180px' }}>
        {/* Background arc */}
        <path d={arcPath(-135, 135, r)} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" strokeLinecap="round"/>

        {/* Zone arcs */}
        <path d={arcPath(-135, -45, r)}  fill="none" stroke="#22c55e" strokeWidth="7" strokeLinecap="round" opacity="0.85"/>
        <path d={arcPath(-45,  45, r)}   fill="none" stroke="#f59e0b" strokeWidth="7" strokeLinecap="round" opacity="0.85"/>
        <path d={arcPath( 45, 135, r)}   fill="none" stroke="#ef4444" strokeWidth="7" strokeLinecap="round" opacity="0.85"/>

        {/* Needle */}
        <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={zoneColor} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx={cx} cy={cy} r="4" fill={zoneColor}/>

        {/* dB label */}
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="9" fontFamily="monospace" fontWeight="600" fill={worstDb == null ? 'rgba(255,255,255,0.2)' : zoneColor}>
          {worstDb == null ? '–' : `${worstDb.toFixed(1)} dBFS`}
        </text>
      </svg>
      <div className="ms-gauge-label">Condition Index</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {ZONES.map((z) => (
          <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--text-3)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '99px', background: z.color, display: 'inline-block' }}/>
            {z.label}
          </div>
        ))}
      </div>
    </div>
  );
}

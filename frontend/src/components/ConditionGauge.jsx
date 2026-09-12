import React from 'react';


/**
 * ISO 20958 Electric Motor Condition Speedometer / Gauge
 * Displays relative sideband decibel drop (dbFS)
 */
export default function ConditionGauge({ worstDb, thresholdDb = -40, isHealthy }) {
  const val = worstDb !== undefined && worstDb !== null ? Number(worstDb) : -50;
  const clamped = Math.max(-60, Math.min(-20, val));

  // Map -60 dB -> 180 deg (left), -20 dB -> 0 deg (right)
  const minDb = -60;
  const maxDb = -20;
  const fraction = (clamped - minDb) / (maxDb - minDb);
  const angleDeg = 180 - fraction * 180;

  const rad = (angleDeg * Math.PI) / 180;
  const needleLen = 65;
  const nx = 100 - needleLen * Math.cos(Math.PI - rad);
  const ny = 100 - needleLen * Math.sin(Math.PI - rad);

  const statusColor =
    val < -45 ? '#00E676' :
    val < -40 ? '#FFD600' :
    val < -35 ? '#FF9100' : '#FF1744';

  const statusLabel =
    val < -45 ? 'CLASS 1: GOOD' :
    val < -40 ? 'CLASS 2: MODERATE' :
    val < -35 ? 'CLASS 3: SERIOUS' : 'CLASS 4: CRITICAL';

  return (
    <div style={{
      background: '#0B111E',
      border: '1px solid #1E2D4A',
      borderRadius: '4px',
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: 'inset 0 0 16px rgba(0, 0, 0, 0.6)'
    }}>
      <div style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '6px',
        borderBottom: '1px solid #18243A',
        paddingBottom: '4px'
      }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#90CAF9', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'monospace' }}>
          ISO 20958 SEVERITY METER
        </span>
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          fontFamily: 'monospace',
          padding: '2px 8px',
          borderRadius: '3px',
          background: `${statusColor}22`,
          border: `1px solid ${statusColor}`,
          color: statusColor
        }}>
          {statusLabel}
        </span>
      </div>

      <svg width="200" height="115" viewBox="0 0 200 115">
        <defs>
          <linearGradient id="gaugeTrack" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00E676" />
            <stop offset="37.5%" stopColor="#FFD600" />
            <stop offset="62.5%" stopColor="#FF9100" />
            <stop offset="100%" stopColor="#FF1744" />
          </linearGradient>
        </defs>

        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#1A2438"
          strokeWidth="14"
          strokeLinecap="round"
        />

        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gaugeTrack)"
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.9"
        />

        <line
          x1="100" y1="10" x2="100" y2="26"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeDasharray="2 2"
        />
        <text x="100" y="8" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontFamily="monospace" fontWeight="700">
          ALARM (`{thresholdDb}dB`)
        </text>

        <text x="20" y="114" textAnchor="middle" fill="#64B5F6" fontSize="9" fontFamily="monospace">-60dB</text>
        <text x="55" y="60" textAnchor="middle" fill="#00E676" fontSize="8" fontFamily="monospace">-50</text>
        <text x="100" y="38" textAnchor="middle" fill="#FFD600" fontSize="8" fontFamily="monospace">-40</text>
        <text x="145" y="60" textAnchor="middle" fill="#FF9100" fontSize="8" fontFamily="monospace">-30</text>
        <text x="180" y="114" textAnchor="middle" fill="#FF1744" fontSize="9" fontFamily="monospace">-20dB</text>

        <line
          x1="100"
          y1="100"
          x2={nx}
          y2={ny}
          stroke={statusColor}
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        <circle cx="100" cy="100" r="8" fill="#1E293B" stroke={statusColor} strokeWidth="2.5" />
        <circle cx="100" cy="100" r="3" fill="#FFFFFF" />
      </svg>

      <div style={{ marginTop: '2px', textAlign: 'center' }}>
        <div style={{
          fontSize: '22px',
          fontWeight: 800,
          fontFamily: 'monospace',
          color: statusColor,
          letterSpacing: '-0.02em',
          lineHeight: 1
        }}>
          {val !== undefined ? `${val.toFixed(2)} dBFS` : '— dBFS'}
        </div>
        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', fontFamily: 'monospace' }}>
          Sideband Energy Drop rel. Carrier (50 Hz)
        </div>
      </div>
    </div>
  );
k}

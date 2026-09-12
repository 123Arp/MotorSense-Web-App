// Legacy icon exports kept for backward compatibility
import React from 'react';

const icon = (d, vb = '0 0 24 24') => function Icon({ className = '', style }) {
  return <svg className={className} style={style} viewBox={vb} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={16} height={16}>{d}</svg>;
};

export const WaveformIcon = icon(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>);
export const UploadIcon = icon(<><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>);
export const SettingsIcon = icon(<><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M16.24 7.76a6 6 0 0 1 0 8.49M4.93 4.93a10 10 0 0 0 0 14.14M7.76 7.76a6 6 0 0 0 0 8.49"/></>);
export const SpectrumIcon = icon(<><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>);
export const FilterIcon = icon(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>);
export const PsdIcon = icon(<><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 14l3-3 3 3 4-4"/></>);
export const EnvelopeIcon = icon(<><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>);
export const TableIcon = icon(<><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></>);
export const DownloadIcon = icon(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>);
export const CpuIcon = icon(<><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/></>);
export const GaugeIcon = icon(<><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"/><path d="M12 6v6l4 2"/></>);
export const FileTextIcon = icon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>);
export const CopyIcon = icon(<><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>);
export const CheckIcon = icon(<polyline points="20 6 9 17 4 12"/>);

export function MotorSenseLogo({ size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: 'linear-gradient(135deg, #1d4ed8, #0ea5e9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 0 0 1px rgba(59,130,246,0.3), 0 0 12px rgba(59,130,246,0.15)',
      flexShrink: 0,
    }}>
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" strokeDasharray="3 1.5" opacity="0.6"/>
        <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.5"/>
        <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M6 12 Q9 8 12 12 Q15 16 18 12" stroke="#93c5fd" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

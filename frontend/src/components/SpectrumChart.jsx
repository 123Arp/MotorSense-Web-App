import React from 'react';
import Plot from 'react-plotly.js';

export const MOTORSENSE_SCREEN_LAYOUT = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'transparent',
  margin: { t: 8, r: 16, b: 40, l: 56 },
  font: { family: "'JetBrains Mono', monospace", color: '#94a3b8', size: 11 },
  legend: {
    bgcolor: 'rgba(17,24,39,0.8)', bordercolor: '#1e2d4a',
    borderwidth: 1, font: { size: 11, color: '#94a3b8' },
    x: 0.01, y: 0.99, xanchor: 'left', yanchor: 'top',
  },
  xaxis: {
    gridcolor: 'rgba(255,255,255,0.05)', zeroline: false,
    linecolor: '#1e2d4a', tickfont: { size: 10, color: '#64748b' },
  },
  yaxis: {
    gridcolor: 'rgba(255,255,255,0.05)', zeroline: false,
    linecolor: '#1e2d4a', tickfont: { size: 10, color: '#64748b' },
  },
};

export default function SpectrumChart({
  title, xFull, yFull, xZoom, yZoom, xLabel, yLabel, traceName,
  traceColor, f_supply, f_sb_lower, f_sb_upper, height = 300,
}) {
  const shapes = [];
  if (f_supply) shapes.push({ type: 'line', x0: f_supply, x1: f_supply, yref: 'paper', y0: 0, y1: 1, line: { color: '#3b82f6', width: 1.5, dash: 'solid' } });
  if (f_sb_lower) shapes.push({ type: 'line', x0: f_sb_lower, x1: f_sb_lower, yref: 'paper', y0: 0, y1: 1, line: { color: '#ef4444', width: 1.5, dash: 'dot' } });
  if (f_sb_upper) shapes.push({ type: 'line', x0: f_sb_upper, x1: f_sb_upper, yref: 'paper', y0: 0, y1: 1, line: { color: '#ef4444', width: 1.5, dash: 'dot' } });

  const data = [];
  if (xFull?.length) data.push({ x: xFull, y: yFull, type: 'scatter', mode: 'lines', name: traceName || 'Full Spectrum', line: { color: traceColor || '#3b82f6', width: 1.2 } });
  if (xZoom?.length) data.push({ x: xZoom, y: yZoom, type: 'scatter', mode: 'lines', name: 'Sideband Zoom', line: { color: '#f59e0b', width: 1.8 }, xaxis: 'x2', yaxis: 'y2', showlegend: true });

  const layout = {
    ...MOTORSENSE_SCREEN_LAYOUT,
    height,
    shapes,
    xaxis: { ...MOTORSENSE_SCREEN_LAYOUT.xaxis, title: { text: xLabel || 'Frequency (Hz)', font: { size: 11 } } },
    yaxis: { ...MOTORSENSE_SCREEN_LAYOUT.yaxis, title: { text: yLabel || 'Amplitude', font: { size: 11 } } },
    ...(xZoom?.length ? {
      xaxis2: { domain: [0.62, 0.99], anchor: 'y2', gridcolor: 'rgba(255,255,255,0.07)', zeroline: false, tickfont: { size: 9 }, linecolor: '#253554', title: { text: 'Zoom (Hz)', font: { size: 9 } } },
      yaxis2: { domain: [0.05, 0.92], anchor: 'x2', gridcolor: 'rgba(255,255,255,0.07)', zeroline: false, tickfont: { size: 9 }, linecolor: '#253554', title: { text: 'dBFS', font: { size: 9 } } },
    } : {}),
  };

  return (
    <div className="ms-card">
      {title && (
        <div className="ms-card-header">
          <span className="ms-card-title" style={{ fontSize: '12px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
            {title}
          </span>
          {f_supply && (
            <div style={{ display: 'flex', gap: '10px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: '#3b82f6' }}>— f₀ = {f_supply.toFixed(1)} Hz</span>
              {f_sb_lower && <span style={{ color: '#ef4444' }}>⋯ LSB / USB</span>}
            </div>
          )}
        </div>
      )}
      <div className="ms-plot-frame">
        <Plot
          data={data}
          layout={layout}
          config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true, modeBarButtonsToRemove: ['toImage'] }}
          style={{ width: '100%' }}
          useResizeHandler
        />
      </div>
    </div>
  );
}

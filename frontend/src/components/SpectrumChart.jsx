import React, { useState } from 'react';
import Plot from 'react-plotly.js';

export const BASE_LAYOUT = {
  paper_bgcolor: '#FFFFFF',
  plot_bgcolor: '#FBFBFD',
  font: { family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', color: '#334155', size: 11 },
  xaxis: {
    gridcolor: '#E8ECEF',
    linecolor: '#CBD5E1',
    tickfont: { family: 'monospace', size: 10, color: '#475569' },
    zerolinecolor: '#CBD5E1',
    title: { font: { size: 11, color: '#475569' } }
  },
  yaxis: {
    gridcolor: '#E8ECEF',
    linecolor: '#CBD5E1',
    tickfont: { family: 'monospace', size: 10, color: '#475569' },
    zerolinecolor: '#CBD5E1',
    title: { font: { size: 11, color: '#475569' } }
  },
  margin: { l: 55, r: 25, t: 25, b: 45 },
  showlegend: true,
  legend: {
    bgcolor: 'rgba(255, 255, 255, 0.95)',
    bordercolor: '#CBD5E1',
    borderwidth: 1,
    font: { size: 10, family: 'monospace' },
  },
  hoverlabel: { bgcolor: '#0F172A', bordercolor: '#334155', font: { family: 'monospace', color: '#FFFFFF' } },
};

export default function SpectrumChart({
  title,
  xFull,
  yFull,
  xZoom,
  yZoom,
  xLabel = 'Frequency (Hz)',
  yLabel = 'Magnitude',
  traceName = 'Spectrum',
  traceColor = '#0F4C81',
  f_supply,
  f_sb_lower,
  f_sb_upper,
  extraTraces = [],
  defaultView = 'zoom',
  height = 260,
}) {
  const [view, setView] = useState(defaultView);
  const x = view === 'zoom' && xZoom && xZoom.length > 0 ? xZoom : xFull;
  const y = view === 'zoom' && yZoom && yZoom.length > 0 ? yZoom : yFull;

  const shapes = [];
  const annotations = [];

  if (f_supply) {
    shapes.push({
      type: 'line',
      x0: f_supply,
      x1: f_supply,
      yref: 'paper',
      y0: 0,
      y1: 1,
      line: { color: '#0F4C81', width: 1.5, dash: 'solid' },
    });
    annotations.push({
      x: f_supply,
      yref: 'paper',
      y: 0.96,
      text: `<b>f₀: ${f_supply.toFixed(1)} Hz</b>`,
      showarrow: false,
      font: { size: 9, color: '#0F4C81', family: 'monospace' },
      bgcolor: 'rgba(255,255,255,0.95)',
      bordercolor: '#0F4C81',
      borderwidth: 1,
      borderpad: 2,
    });
  }

  if (f_sb_lower) {
    shapes.push({
      type: 'line',
      x0: f_sb_lower,
      x1: f_sb_lower,
      yref: 'paper',
      y0: 0,
      y1: 1,
      line: { color: '#B91C1C', width: 1.5, dash: 'dot' },
    });
    annotations.push({
      x: f_sb_lower,
      yref: 'paper',
      y: 0.82,
      text: `<b>SB-: ${f_sb_lower.toFixed(2)} Hz</b>`,
      showarrow: false,
      font: { size: 9, color: '#B91C1C', family: 'monospace' },
      bgcolor: 'rgba(255,255,255,0.95)',
      bordercolor: '#B91C1C',
      borderwidth: 1,
      borderpad: 2,
    });
  }

  if (f_sb_upper) {
    shapes.push({
      type: 'line',
      x0: f_sb_upper,
      x1: f_sb_upper,
      yref: 'paper',
      y0: 0,
      y1: 1,
      line: { color: '#B91C1C', width: 1.5, dash: 'dot' },
    });
    annotations.push({
      x: f_sb_upper,
      yref: 'paper',
      y: 0.82,
      text: `<b>SB+: ${f_sb_upper.toFixed(2)} Hz</b>`,
      showarrow: false,
      font: { size: 9, color: '#B91C1C', family: 'monospace' },
      bgcolor: 'rgba(255,255,255,0.95)',
      bordercolor: '#B91C1C',
      borderwidth: 1,
      borderpad: 2,
    });
  }

  const traces = [
    {
      x: x || [],
      y: y || [],
      type: 'scatter',
      mode: 'lines',
      name: traceName,
      line: { color: traceColor, width: 1.5 },
    },
    ...extraTraces,
  ];

  const layout = {
    ...BASE_LAYOUT,
    height,
    shapes,
    annotations,
    xaxis: { ...BASE_LAYOUT.xaxis, title: { text: xLabel, font: { size: 11, color: '#475569' } } },
    yaxis: { ...BASE_LAYOUT.yaxis, title: { text: yLabel, font: { size: 11, color: '#475569' } } },
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#1E293B', fontFamily: 'monospace' }}>{title}</div>
        {xZoom && xFull && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`btn-inst-secondary ${view === 'zoom' ? 'active' : ''}`}
              style={{ height: '24px', fontSize: '10px', padding: '0 8px', fontFamily: 'monospace' }}
              onClick={() => setView('zoom')}
            >
              SPAN: ±50 Hz (CARRIER ZOOM)
            </button>
            <button
              type="button"
              className={`btn-inst-secondary ${view === 'full' ? 'active' : ''}`}
              style={{ height: '24px', fontSize: '10px', padding: '0 8px', fontFamily: 'monospace' }}
              onClick={() => setView('full')}
            >
              SPAN: FULL (0 - 25 kHz)
            </button>
          </div>
        )}
      </div>

      <Plot
        data={traces}
        layout={layout}
        config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
        style={{ width: '100%' }}
        useResizeHandler
      />
    </div>
  );
}

import React, { useState } from 'react';
import Plot from 'react-plotly.js';

export const BASE_LAYOUT = {
  paper_bgcolor: '#FFFFFF',
  plot_bgcolor: '#FAFAFA',
  font: { family: 'Inter, sans-serif', color: '#374151', size: 11 },
  xaxis: {
    gridcolor: '#F3F4F6',
    linecolor: '#D1D5DB',
    tickfont: { family: 'monospace', size: 10 },
    zerolinecolor: '#E5E7EB',
  },
  yaxis: {
    gridcolor: '#F3F4F6',
    linecolor: '#D1D5DB',
    tickfont: { family: 'monospace', size: 10 },
  },
  margin: { l: 55, r: 25, t: 25, b: 45 },
  showlegend: true,
  legend: {
    bgcolor: 'rgba(255,255,255,0.9)',
    bordercolor: '#E5E7EB',
    borderwidth: 1,
    font: { size: 11 },
  },
  hoverlabel: { bgcolor: '#FFFFFF', bordercolor: '#E5E7EB', font: { family: 'monospace' } },
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
  traceColor = '#1A56DB',
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
      line: { color: '#1A56DB', width: 1.5, dash: 'solid' },
    });
    annotations.push({
      x: f_supply,
      yref: 'paper',
      y: 0.96,
      text: `<b>f₀:</b> ${f_supply.toFixed(1)} Hz`,
      showarrow: false,
      font: { size: 9, color: '#1A56DB', family: 'monospace' },
      bgcolor: 'rgba(255,255,255,0.9)',
      bordercolor: '#1A56DB',
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
      line: { color: '#C81E1E', width: 1.5, dash: 'dot' },
    });
    annotations.push({
      x: f_sb_lower,
      yref: 'paper',
      y: 0.82,
      text: `<b>SB-:</b> ${f_sb_lower.toFixed(2)} Hz`,
      showarrow: false,
      font: { size: 9, color: '#C81E1E', family: 'monospace' },
      bgcolor: 'rgba(255,255,255,0.9)',
      bordercolor: '#C81E1E',
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
      line: { color: '#C81E1E', width: 1.5, dash: 'dot' },
    });
    annotations.push({
      x: f_sb_upper,
      yref: 'paper',
      y: 0.82,
      text: `<b>SB+:</b> ${f_sb_upper.toFixed(2)} Hz`,
      showarrow: false,
      font: { size: 9, color: '#C81E1E', family: 'monospace' },
      bgcolor: 'rgba(255,255,255,0.9)',
      bordercolor: '#C81E1E',
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
    xaxis: { ...BASE_LAYOUT.xaxis, title: { text: xLabel, font: { size: 11 } } },
    yaxis: { ...BASE_LAYOUT.yaxis, title: { text: yLabel, font: { size: 11 } } },
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{title}</div>
        {xZoom && xFull && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`btn-ghost ${view === 'zoom' ? 'active' : ''}`}
              onClick={() => setView('zoom')}
            >
              Zoom (Carrier ±50 Hz)
            </button>
            <button
              type="button"
              className={`btn-ghost ${view === 'full' ? 'active' : ''}`}
              onClick={() => setView('full')}
            >
              Full Spectrum (0-25 kHz)
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

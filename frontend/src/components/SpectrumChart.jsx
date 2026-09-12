import React, { useState } from 'react';
import Plot from 'react-plotly.js';

export const MOTORSENSE_SCREEN_LAYOUT = {
  paper_bgcolor: '#090D16',
  plot_bgcolor: '#090D16',
  font: { family: 'JetBrains Mono, monospace', color: '#90CAF9', size: 12 },
  xaxis: {
    gridcolor: '#152033',
    linecolor: '#263852',
    tickfont: { family: 'monospace', size: 11, color: '#90CAF9' },
    zerolinecolor: '#263852',
    title: { font: { size: 12, color: '#90CAF9' } },
  },
  yaxis: {
    gridcolor: '#152033',
    linecolor: '#263852',
    tickfont: { family: 'monospace', size: 11, color: '#90CAF9' },
    zerolinecolor: '#263852',
    title: { font: { size: 12, color: '#90CAF9' } },
  },
  margin: { l: 55, r: 25, t: 25, b: 45 },
  showlegend: true,
  legend: {
    bgcolor: 'rgba(9, 13, 22, 0.9)',
    bordercolor: '#263852',
    borderwidth: 1,
    font: { size: 11, color: '#E0E6ED', family: 'monospace' },
  },
  hoverlabel: { bgcolor: '#002B49', bordercolor: '#00E5FF', font: { family: 'monospace', color: '#FFFFFF', size: 12 } },
};

export default function SpectrumChart({
  title,
  xFull,
  yFull,
  xZoom,
  yZoom,
  xLabel = 'Frequency (Hz)',
  yLabel = 'Magnitude',
  traceName = 'Stator Current FFT',
  traceColor = '#00E5FF',
  f_supply,
  f_sb_lower,
  f_sb_upper,
  extraTraces = [],
  defaultView = 'zoom',
  height = 270,
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
      line: { color: '#2979FF', width: 2, dash: 'solid' },
    });
    annotations.push({
      x: f_supply,
      yref: 'paper',
      y: 0.96,
      text: `Carrier f₀: ${f_supply.toFixed(1)}Hz`,
      showarrow: false,
      font: { size: 11, color: '#2979FF', family: 'monospace', weight: 700 },
      bgcolor: 'rgba(9, 13, 22, 0.9)',
      bordercolor: '#2979FF',
      borderwidth: 1,
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
      line: { color: '#FF1744', width: 2, dash: 'dot' },
    });
    annotations.push({
      x: f_sb_lower,
      yref: 'paper',
      y: 0.84,
      text: `SB-: ${f_sb_lower.toFixed(2)}Hz`,
      showarrow: false,
      font: { size: 11, color: '#FF1744', family: 'monospace', weight: 700 },
      bgcolor: 'rgba(9, 13, 22, 0.9)',
      bordercolor: '#FF1744',
      borderwidth: 1,
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
      line: { color: '#FF1744', width: 2, dash: 'dot' },
    });
    annotations.push({
      x: f_sb_upper,
      yref: 'paper',
      y: 0.84,
      text: `SB+: ${f_sb_upper.toFixed(2)}Hz`,
      showarrow: false,
      font: { size: 11, color: '#FF1744', family: 'monospace', weight: 700 },
      bgcolor: 'rgba(9, 13, 22, 0.9)',
      bordercolor: '#FF1744',
      borderwidth: 1,
    });
  }

  const traces = [
    {
      x: x || [],
      y: y || [],
      type: 'scatter',
      mode: 'lines',
      name: traceName,
      line: { color: traceColor, width: 1.8 },
    },
    ...extraTraces,
  ];

  return (
    <div style={{ background: '#090D16', border: '1px solid #1C293E', borderRadius: '4px', padding: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', padding: '0 4px' }}>
        <span style={{ fontSize: '13px', fontFamily: 'monospace', fontWeight: 700, color: '#00E5FF' }}>
          {title}
        </span>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            className="btn-m1k"
            style={{
              height: '24px',
              fontSize: '11px',
              background: view === 'zoom' ? '#0F3C63' : '#141E30',
              color: view === 'zoom' ? '#FFFFFF' : '#94A3B8',
              borderColor: view === 'zoom' ? '#0284C7' : '#223450',
            }}
            onClick={() => setView('zoom')}
          >
            Zoom [40 - 60 Hz]
          </button>
          <button
            type="button"
            className="btn-m1k"
            style={{
              height: '24px',
              fontSize: '11px',
              background: view === 'full' ? '#0F3C63' : '#141E30',
              color: view === 'full' ? '#FFFFFF' : '#94A3B8',
              borderColor: view === 'full' ? '#0284C7' : '#223450',
            }}
            onClick={() => setView('full')}
          >
            Full [0 - 200 Hz]
          </button>
        </div>
      </div>

      <Plot
        data={traces}
        layout={{
          ...MOTORSENSE_SCREEN_LAYOUT,
          height,
          shapes,
          annotations,
          xaxis: { ...MOTORSENSE_SCREEN_LAYOUT.xaxis, title: { text: xLabel, font: { size: 12, color: '#90CAF9' } } },
          yaxis: { ...MOTORSENSE_SCREEN_LAYOUT.yaxis, title: { text: yLabel, font: { size: 12, color: '#90CAF9' } } },
        }}
        config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
        style={{ width: '100%' }}
        useResizeHandler
      />
    </div>
  );
}

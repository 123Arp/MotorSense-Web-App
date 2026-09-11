import React, { useState } from 'react';
import Plot from 'react-plotly.js';

export const ALICE_SCREEN_LAYOUT = {
  paper_bgcolor: '#090D16',
  plot_bgcolor: '#090D16',
  font: { family: 'JetBrains Mono, monospace', color: '#90CAF9', size: 10 },
  xaxis: {
    gridcolor: '#152033',
    linecolor: '#263852',
    tickfont: { family: 'monospace', size: 9, color: '#64B5F6' },
    zerolinecolor: '#263852',
    title: { font: { size: 10, color: '#90CAF9' } },
  },
  yaxis: {
    gridcolor: '#152033',
    linecolor: '#263852',
    tickfont: { family: 'monospace', size: 9, color: '#64B5F6' },
    zerolinecolor: '#263852',
    title: { font: { size: 10, color: '#90CAF9' } },
  },
  margin: { l: 50, r: 20, t: 20, b: 40 },
  showlegend: true,
  legend: {
    bgcolor: 'rgba(9, 13, 22, 0.9)',
    bordercolor: '#263852',
    borderwidth: 1,
    font: { size: 9, color: '#E0E6ED', family: 'monospace' },
  },
  hoverlabel: { bgcolor: '#002B49', bordercolor: '#00E5FF', font: { family: 'monospace', color: '#FFFFFF' } },
};

export default function SpectrumChart({
  title,
  xFull,
  yFull,
  xZoom,
  yZoom,
  xLabel = 'Frequency (Hz)',
  yLabel = 'Magnitude',
  traceName = 'CH A (FFT)',
  traceColor = '#00E5FF',
  f_supply,
  f_sb_lower,
  f_sb_upper,
  extraTraces = [],
  defaultView = 'zoom',
  height = 250,
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
      line: { color: '#2979FF', width: 1.5, dash: 'solid' },
    });
    annotations.push({
      x: f_supply,
      yref: 'paper',
      y: 0.96,
      text: `f₀: ${f_supply.toFixed(1)}Hz`,
      showarrow: false,
      font: { size: 9, color: '#2979FF', family: 'monospace' },
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
      line: { color: '#FF1744', width: 1.5, dash: 'dot' },
    });
    annotations.push({
      x: f_sb_lower,
      yref: 'paper',
      y: 0.84,
      text: `SB-: ${f_sb_lower.toFixed(2)}Hz`,
      showarrow: false,
      font: { size: 9, color: '#FF1744', family: 'monospace' },
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
      line: { color: '#FF1744', width: 1.5, dash: 'dot' },
    });
    annotations.push({
      x: f_sb_upper,
      yref: 'paper',
      y: 0.84,
      text: `SB+: ${f_sb_upper.toFixed(2)}Hz`,
      showarrow: false,
      font: { size: 9, color: '#FF1744', family: 'monospace' },
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
      line: { color: traceColor, width: 1.5 },
    },
    ...extraTraces,
  ];

  const layout = {
    ...ALICE_SCREEN_LAYOUT,
    height,
    shapes,
    annotations,
    xaxis: { ...ALICE_SCREEN_LAYOUT.xaxis, title: { text: xLabel, font: { size: 10, color: '#90CAF9' } } },
    yaxis: { ...ALICE_SCREEN_LAYOUT.yaxis, title: { text: yLabel, font: { size: 10, color: '#90CAF9' } } },
  };

  return (
    <div style={{ background: '#090D16', border: '1px solid #1F2C42', borderRadius: '2px', padding: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', padding: '0 4px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#64B5F6', fontFamily: 'monospace' }}>
          {title}
        </div>
        {xZoom && xFull && (
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className="btn-m1k"
              style={{
                height: '20px', fontSize: '9px', padding: '0 6px',
                background: view === 'zoom' ? '#00E5FF' : '#1A2333',
                color: view === 'zoom' ? '#000000' : '#81A1C1',
                borderColor: view === 'zoom' ? '#00B8D4' : '#2C3E5A',
                fontWeight: 700
              }}
              onClick={() => setView('zoom')}
            >
              ZOOM (±50 Hz)
            </button>
            <button
              type="button"
              className="btn-m1k"
              style={{
                height: '20px', fontSize: '9px', padding: '0 6px',
                background: view === 'full' ? '#00E5FF' : '#1A2333',
                color: view === 'full' ? '#000000' : '#81A1C1',
                borderColor: view === 'full' ? '#00B8D4' : '#2C3E5A',
                fontWeight: 700
              }}
              onClick={() => setView('full')}
            >
              FULL SPAN (25 kHz)
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

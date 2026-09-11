import { useState } from "react";
import Plot from "react-plotly.js";

const BASE_LAYOUT = {
  paper_bgcolor: "#FFFFFF",
  plot_bgcolor: "#FAFAFA",
  font: { family: "Inter, sans-serif", color: "#374151", size: 11 },
  xaxis: {
    gridcolor: "#F3F4F6",
    linecolor: "#D1D5DB",
    tickfont: { family: "JetBrains Mono, monospace", size: 10 },
    title: { font: { size: 11 } },
    zerolinecolor: "#E5E7EB",
  },
  yaxis: {
    gridcolor: "#F3F4F6",
    linecolor: "#D1D5DB",
    tickfont: { family: "JetBrains Mono, monospace", size: 10 },
    title: { font: { size: 11 } },
  },
  margin: { l: 60, r: 20, t: 36, b: 50 },
  showlegend: true,
  legend: {
    bgcolor: "rgba(255,255,255,0.9)",
    bordercolor: "#E5E7EB",
    borderwidth: 1,
    font: { size: 11 },
  },
  hoverlabel: { bgcolor: "#fff", bordercolor: "#E5E7EB", font: { family: "JetBrains Mono, monospace" } },
};

function makeMarkers(f_supply, f_sb_lower, f_sb_upper, y_max) {
  if (!f_supply) return { shapes: [], annotations: [] };
  const h = y_max || 1;
  const line = (x, color, dash) => ({
    type: "line", x0: x, x1: x, y0: 0, y1: h,
    yref: "paper", y0: 0, y1: 1,
    line: { color, width: 1.5, dash },
    layer: "above",
  });
  const ann = (x, label, color) => ({
    x, yref: "paper", y: 0.97,
    text: `<b>${label}</b><br>${x.toFixed(2)} Hz`,
    showarrow: false,
    font: { size: 9, color, family: "JetBrains Mono, monospace" },
    bgcolor: "rgba(255,255,255,0.85)",
    bordercolor: color,
    borderwidth: 1,
    borderpad: 2,
  });
  return {
    shapes: [
      line(f_supply,   "#1A56DB", "solid"),
      line(f_sb_lower, "#C81E1E", "dot"),
      line(f_sb_upper, "#C81E1E", "dot"),
    ],
    annotations: [
      ann(f_supply,   "f₀", "#1A56DB"),
      ann(f_sb_lower, "SB−", "#C81E1E"),
      ann(f_sb_upper, "SB+", "#C81E1E"),
    ],
  };
}

/**
 * Reusable spectrum chart with zoom/full toggle.
 *
 * Props:
 *   title, xFull, yFull, xZoom, yZoom   — data arrays
 *   xLabel, yLabel                        — axis labels
 *   traceName                             — legend name for trace 1
 *   traceColor                            — color
 *   f_supply, f_sb_lower, f_sb_upper     — marker frequencies
 *   extraTraces                           — additional Plotly trace objects (for comparison)
 *   defaultView                           — "zoom" | "full"
 *   height                               — chart height (px)
 */
export default function SpectrumChart({
  title,
  xFull, yFull,
  xZoom, yZoom,
  xLabel = "Frequency (Hz)",
  yLabel = "Amplitude",
  traceName = "Signal",
  traceColor = "#1A56DB",
  f_supply, f_sb_lower, f_sb_upper,
  extraTraces = [],
  defaultView = "zoom",
  height = 260,
}) {
  const [view, setView] = useState(defaultView);
  const x = view === "zoom" ? xZoom : xFull;
  const y = view === "zoom" ? yZoom : yFull;

  const { shapes, annotations } = makeMarkers(f_supply, f_sb_lower, f_sb_upper);

  const mainTrace = {
    x, y,
    type: "scatter",
    mode: "lines",
    name: traceName,
    line: { color: traceColor, width: 1.5 },
  };

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
      <div className="chart-header">
        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "#374151" }}>{title}</div>
        {(xZoom && xFull) && (
          <div className="view-toggle">
            <button
              className={`btn-ghost ${view === "zoom" ? "active" : ""}`}
              onClick={() => setView("zoom")}
            >
              ±50 Hz zoom
            </button>
            <button
              className={`btn-ghost ${view === "full" ? "active" : ""}`}
              onClick={() => setView("full")}
            >
              Full spectrum
            </button>
          </div>
        )}
      </div>
      <Plot
        data={[mainTrace, ...extraTraces]}
        layout={layout}
        config={{ responsive: true, displayModeBar: true, displaylogo: false, scrollZoom: true }}
        style={{ width: "100%" }}
        useResizeHandler
      />
    </div>
  );
}

export { BASE_LAYOUT, makeMarkers };

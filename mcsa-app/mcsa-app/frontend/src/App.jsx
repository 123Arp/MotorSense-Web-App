import { useState } from "react";
import ParameterPanel from "./components/ParameterPanel";
import PipelineView from "./components/PipelineView";
import ComparisonView from "./components/ComparisonView";

const DEFAULT_PARAMS = {
  fs: 50000,
  f_supply: 50,
  rated_rpm: 1450,
  poles: 4,
  low_cut: 1,
  high_cut: 200,
  filter_order: 4,
  threshold_dB: -40,
  column: "I1",
};

export default function App() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [activeTab, setActiveTab] = useState("pipeline");

  const updateParam = (key, val) => setParams((p) => ({ ...p, [key]: val }));

  return (
    <div className="app-shell">
      {/* -- Header --------------------------------------------------- */}
      <header
        className="app-header"
        style={{
          background: "#fff",
          borderBottom: "1px solid #E5E7EB",
          padding: "0 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          height: "52px",
          flexShrink: 0,
        }}
      >
        <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
          <rect x="3" y="15" width="4" height="13" rx="1" fill="#1A56DB" />
          <rect x="9" y="9" width="4" height="19" rx="1" fill="#1A56DB" />
          <rect x="15" y="4" width="4" height="24" rx="1" fill="#1A56DB" />
          <rect x="21" y="11" width="4" height="17" rx="1" fill="#1A56DB" />
        </svg>
        <div>
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 700,
              color: "#111928",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            MotorSense
          </div>
          <div style={{ fontSize: "0.7rem", color: "#6B7280", marginTop: "1px" }}>
            Motor Current Signature Analysis · Predictive Maintenance
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <span
            style={{
              fontSize: "0.7rem",
              padding: "0.2rem 0.6rem",
              background: "#EBF0FF",
              color: "#1A56DB",
              borderRadius: "3px",
              fontWeight: 600,
            }}
          >
            50 kHz · 9-ch
          </span>
        </div>
      </header>

      {/* -- Body ----------------------------------------------------- */}
      <div className="app-body">
        <aside className="sidebar">
          <ParameterPanel params={params} updateParam={updateParam} />
        </aside>

        <main className="main-area">
          {/* Tab bar */}
          <div className="tab-bar">
            <button
              className={`tab-btn ${activeTab === "pipeline" ? "active" : ""}`}
              onClick={() => setActiveTab("pipeline")}
            >
              ?? Single File — Pipeline Walkthrough
            </button>
            <button
              className={`tab-btn ${activeTab === "comparison" ? "active" : ""}`}
              onClick={() => setActiveTab("comparison")}
            >
              ? Healthy vs. Faulty Comparison
            </button>
          </div>

          {activeTab === "pipeline" ? (
            <PipelineView params={params} updateParam={updateParam} />
          ) : (
            <ComparisonView params={params} />
          )}
        </main>
      </div>
    </div>
  );
}

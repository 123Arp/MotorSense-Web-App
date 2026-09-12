import React, { useState, useEffect } from 'react';
import ParameterPanel from './components/ParameterPanel';
import PipelineView from './components/PipelineView';
import ComparisonView from './components/ComparisonView';
import api, { getApiBaseUrl, setApiBaseUrl } from './api';

const DEFAULT_PARAMS = {
  fs: 50000,
  f_supply: 50.0,
  rated_rpm: 1450.0,
  poles: 4,
  low_cut: 1.0,
  high_cut: 200.0,
  filter_order: 4,
  threshold_dB: -40.0,
  column: 'I1',
};

export default function App() {
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [activeTab, setActiveTab] = useState('pipeline');
  const [apiConnected, setApiConnected] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [customApiUrl, setCustomApiUrl] = useState(getApiBaseUrl());

  const updateParam = (key, val) => setParams((p) => ({ ...p, [key]: val }));

  const checkHealth = () => {
    api.get('/api/health')
      .then((res) => setApiConnected(res.data?.status === 'ok'))
      .catch(() => setApiConnected(false));
  };

  useEffect(() => {
    checkHealth();
    const t = setInterval(checkHealth, 30000);
    return () => clearInterval(t);
  }, [customApiUrl]);

  const saveApiUrl = () => {
    setApiBaseUrl(customApiUrl.trim());
    setShowConfigModal(false);
    checkHealth();
  };

  const dotClass = apiConnected === true ? 'green' : apiConnected === false ? 'red' : 'amber';
  const statusLabel = apiConnected === true ? 'Backend Online' : apiConnected === false ? 'Backend Offline' : 'Connecting…';

  return (
    <div className="ms-app">
      {/* ── Header ── */}
      <header className="ms-header">
        <div className="ms-header-left">
          <div className="ms-logo-ring">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.5" strokeDasharray="3 1.5" opacity="0.6"/>
              <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.5"/>
              <path d="M12 3v3M12 18v3M3 12h3M18 12h3" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M6 12 Q9 8 12 12 Q15 16 18 12" stroke="#60a5fa" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="ms-brand-name">MotorSense</div>
            <div className="ms-brand-sub">Motor Current Signature Analysis</div>
          </div>
          <span className="ms-badge">ISO 20958 · MCSA</span>
        </div>

        <div className="ms-header-right">
          <button
            type="button"
            className={`ms-status-btn ${apiConnected === true ? 'online' : apiConnected === false ? 'offline' : ''}`}
            onClick={() => setShowConfigModal(true)}
          >
            <span className={`ms-dot ${dotClass}`} />
            {statusLabel}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
              <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M16.24 7.76a6 6 0 0 1 0 8.49M4.93 4.93a10 10 0 0 0 0 14.14M7.76 7.76a6 6 0 0 0 0 8.49"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── Tab Nav ── */}
      <nav className="ms-nav">
        <button
          type="button"
          className={`ms-tab ${activeTab === 'pipeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('pipeline')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          Analysis
        </button>
        <button
          type="button"
          className={`ms-tab ${activeTab === 'comparison' ? 'active' : ''}`}
          onClick={() => setActiveTab('comparison')}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="18" rx="1"/>
          </svg>
          Comparison
        </button>
      </nav>

      {/* ── Body ── */}
      <div className="ms-body">
        <aside className="ms-sidebar">
          <ParameterPanel params={params} updateParam={updateParam} />
        </aside>
        <main className="ms-main">
          {activeTab === 'pipeline'
            ? <PipelineView params={params} updateParam={updateParam} />
            : <ComparisonView params={params} />}
        </main>
      </div>

      {/* ── Status bar ── */}
      <div className="ms-statusbar">
        <div className="ms-statusbar-left">
          <span>DSP Engine: MotorSense v2.4</span>
          <span>Window: Hanning</span>
          <span>Standard: ISO 20958-1 / IEEE 1415</span>
        </div>
        <span>{params.fs.toLocaleString()} Hz · {params.poles}P · {params.rated_rpm} RPM</span>
      </div>

      {/* ── Backend Config Modal ── */}
      {showConfigModal && (
        <div className="ms-modal-bg" onClick={(e) => e.target === e.currentTarget && setShowConfigModal(false)}>
          <div className="ms-modal">
            <div className="ms-modal-header">
              <span className="ms-modal-title">Backend Connection</span>
              <button type="button" className="ms-modal-close" onClick={() => setShowConfigModal(false)}>✕</button>
            </div>
            <div className="ms-modal-body">
              <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '16px', lineHeight: 1.6 }}>
                Enter the URL of your MotorSense FastAPI backend. Leave empty to use the local proxy (<code>/api</code>).
              </p>
              <label className="ms-label">API Base URL</label>
              <input
                type="text"
                className="ms-input"
                placeholder="https://motorsense-api.onrender.com"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveApiUrl()}
                style={{ marginBottom: '12px' }}
              />
              <div className="ms-alert ms-alert-info" style={{ fontSize: '12px' }}>
                The app will check <code>GET /api/health</code> to verify the connection.
              </div>
            </div>
            <div className="ms-modal-footer">
              <button type="button" className="ms-btn ms-btn-sm" onClick={() => setShowConfigModal(false)}>Cancel</button>
              <button type="button" className="ms-btn ms-btn-primary ms-btn-sm" onClick={saveApiUrl}>Save & Connect</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

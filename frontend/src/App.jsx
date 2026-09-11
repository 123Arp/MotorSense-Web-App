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

  const updateParam = (key, val) => {
    setParams((prev) => ({ ...prev, [key]: val }));
  };

  const checkHealth = () => {
    api.get('/api/health')
      .then((res) => {
        if (res.data && res.data.status === 'ok') {
          setApiConnected(true);
        } else {
          setApiConnected(false);
        }
      })
      .catch(() => {
        setApiConnected(false);
      });
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [customApiUrl]);

  const saveApiUrl = () => {
    setApiBaseUrl(customApiUrl.trim());
    setShowConfigModal(false);
    checkHealth();
  };

  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="app-header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
            <rect x="3" y="16" width="4" height="12" rx="1" fill="#1A56DB" />
            <rect x="9" y="10" width="4" height="18" rx="1" fill="#1A56DB" />
            <rect x="15" y="4" width="4" height="24" rx="1" fill="#1A56DB" />
            <rect x="21" y="12" width="4" height="16" rx="1" fill="#1A56DB" />
            <rect x="27" y="18" width="4" height="10" rx="1" fill="#1A56DB" />
          </svg>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#111928', display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1 }}>
              <span>MotorSense</span>
              <span style={{ fontSize: '10px', background: '#EBF0FF', color: '#1A56DB', fontFamily: 'monospace', padding: '2px 6px', borderRadius: '3px', fontWeight: 600 }}>
                MCSA v1.0
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>
              DSP-Based Motor Current Signature Analysis for Predictive Maintenance
            </div>
          </div>
        </div>

        {/* Status Indicators & Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', fontSize: '12px', border: '1px solid #D1D5DB', borderRadius: '4px', background: '#FFFFFF', cursor: 'pointer' }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                display: 'inline-block',
                background: apiConnected === true ? '#057A55' : apiConnected === false ? '#C81E1E' : '#F59E0B',
              }}
            />
            <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#374151' }}>
              {apiConnected === true ? 'Backend Online' : apiConnected === false ? 'Backend Offline' : 'Connecting...'}
            </span>
          </button>

          <span style={{ fontSize: '11px', fontFamily: 'monospace', background: '#F3F4F6', color: '#4B5563', padding: '4px 8px', borderRadius: '4px' }}>
            50 kHz Synchronized
          </span>
        </div>
      </header>

      {/* Main Container */}
      <div className="app-body">
        {/* Left Sidebar */}
        <aside className="sidebar">
          <ParameterPanel params={params} updateParam={updateParam} />
        </aside>

        {/* Content Area */}
        <main className="main-area">
          <div className="tab-bar">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('pipeline')}
            >
              📊 Single-File DSP Pipeline Walkthrough
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'comparison' ? 'active' : ''}`}
              onClick={() => setActiveTab('comparison')}
            >
              ⚖ Healthy vs. Faulty Comparative Analysis
            </button>
          </div>

          {activeTab === 'pipeline' ? (
            <PipelineView params={params} updateParam={updateParam} />
          ) : (
            <ComparisonView params={params} />
          )}
        </main>
      </div>

      {/* Backend URL Modal */}
      {showConfigModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '8px', maxWidth: '440px', width: '100%', padding: '1.25rem', border: '1px solid #E5E7EB', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#111928', marginBottom: '4px' }}>Backend API Connection</h3>
            <p style={{ fontSize: '12px', color: '#6B7280', marginBottom: '16px', lineHeight: 1.5 }}>
              If MotorSense frontend is hosted on Netlify or cloud static hosting, point it to your active backend (e.g. <code style={{ background: '#F3F4F6', padding: '2px 4px', borderRadius: '3px', fontFamily: 'monospace' }}>https://motorsense-api.onrender.com</code>). Leave empty for local development.
            </p>

            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: '#374151', marginBottom: '4px' }}>Backend API URL:</label>
            <input
              type="text"
              placeholder="https://motorsense-api.onrender.com"
              value={customApiUrl}
              onChange={(e) => setCustomApiUrl(e.target.value)}
              className="param-input"
              style={{ fontSize: '12px', marginBottom: '16px' }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="btn-ghost"
                style={{ padding: '6px 12px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveApiUrl}
                className="btn-primary"
                style={{ padding: '6px 12px' }}
              >
                Save &amp; Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

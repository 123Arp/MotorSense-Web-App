import React, { useState, useEffect } from 'react';
import ParameterPanel from './components/ParameterPanel';
import PipelineView from './components/PipelineView';
import ComparisonView from './components/ComparisonView';
import { WaveformIcon, TableIcon, SettingsIcon } from './components/Icons';
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
      {/* Precision Instrument Header */}
      <header className="inst-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Hardware Oscilloscope Wave Logo */}
          <div style={{
            width: '28px', height: '28px', background: '#0F4C81', border: '1px solid #38BDF8',
            borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 12h3l3-7 4 14 4-10 3 6h3" />
            </svg>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1 }}>
              <span style={{ fontSize: '14px', fontWeight: 800, letterSpacing: '0.06em', color: '#FFFFFF' }}>
                MOTORSENSE™
              </span>
              <span style={{ fontSize: '10px', fontFamily: 'monospace', background: '#1E293B', color: '#94A3B8', padding: '2px 5px', borderRadius: '2px', border: '1px solid #334155' }}>
                MCSA INDUSTRIAL ANALYZER v2.4
              </span>
            </div>
            <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '3px', letterSpacing: '0.02em' }}>
              Condition Monitoring & Diagnostics of Machine Systems — Electrical Signature Analysis (ISO 20958)
            </div>
          </div>
        </div>

        {/* Top-Right Telemetry Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 8px',
            background: '#1E293B', border: '1px solid #334155', borderRadius: '2px',
            fontFamily: 'monospace', fontSize: '11px', color: '#94A3B8'
          }}>
            <span>ACQ CLOCK:</span>
            <strong style={{ color: '#E2E8F0' }}>50.00 kHz</strong>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 8px',
            background: '#1E293B', border: '1px solid #334155', borderRadius: '2px',
            fontFamily: 'monospace', fontSize: '11px', color: '#94A3 CH'
          }}>
            <span>CHANNELS:</span>
            <strong style={{ color: '#E2E8F0' }}>9-CH SYNC</strong>
          </div>

          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px',
              borderRadius: '2px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px',
              background: apiConnected === true ? '#052E16' : '#450A0A',
              border: `1px solid ${apiConnected === true ? '#15803D' : '#991B1B'}`,
              color: apiConnected === true ? '#86EFAC' : '#FCA5A5',
            }}
          >
            <span
              style={{
                width: '7px', height: '7px', borderRadius: '50%',
                background: apiConnected === true ? '#22C55E' : apiConnected === false ? '#EF4444' : '#F59E0B'
              }}
            />
            <span>
              {apiConnected === true ? 'DSP BACKEND: ONLINE' : apiConnected === false ? 'DSP BACKEND: OFFLINE' : 'DSP BACKEND: CONNECTING'}
            </span>
            <SettingsIcon className="w-3 h-3 opacity-70" />
          </button>
        </div>
      </header>

      {/* Sub-Navigation Bar */}
      <div className="inst-subnav">
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            className={`tab-inst ${activeTab === 'pipeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('pipeline')}
          >
            <WaveformIcon className="w-3.5 h-3.5" />
            [01] 7-STAGE MCSA DSP PIPELINE WALKTHROUGH
          </button>
          <button
            type="button"
            className={`tab-inst ${activeTab === 'comparison' ? 'active' : ''}`}
            onClick={() => setActiveTab('comparison')}
          >
            <TableIcon className="w-3.5 h-3.5" />
            [02] COMPARATIVE BENCHMARK (HEALTHY vs. FAULTY)
          </button>
        </div>

        <div style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>
          STANDARDS: <strong>ISO 20958</strong> / <strong>IEEE Std 1415</strong>
        </div>
      </div>

      {/* Main Instrumentation Console Workspace */}
      <div className="app-workspace">
        {/* Left Parameter Panel */}
        <aside className="inst-sidebar">
          <ParameterPanel params={params} updateParam={updateParam} />
        </aside>

        {/* Main Canvas Area */}
        <main className="inst-canvas">
          {activeTab === 'pipeline' ? (
            <PipelineView params={params} updateParam={updateParam} />
          ) : (
            <ComparisonView params={params} />
          )}
        </main>
      </div>

      {/* Backend Connection Modal */}
      {showConfigModal && (
        <div className="inst-modal-backdrop">
          <div className="inst-modal-window">
            <div style={{ padding: '12px 16px', background: '#0F172A', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                HARDWARE / API ENDPOINT CONFIGURATION
              </span>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '16px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '16px', fontSize: '12px', color: '#334155' }}>
              <p style={{ margin: '0 0 12px 0', lineHeight: 1.5 }}>
                Configure the active DSP Processing Kernel URL. Leave empty to use local relative proxy (<code>/api</code>).
              </p>

              <label className="inst-label">Remote API Endpoint Host URL:</label>
              <input
                type="text"
                placeholder="https://motorsense-api.onrender.com"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
                className="inst-input"
                style={{ marginBottom: '14px' }}
              />

              <div style={{ fontSize: '11px', color: '#64748B', background: '#F8FAFC', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '2px', marginBottom: '16px' }}>
                <strong>Verification Test:</strong> Calls <code>GET /api/health</code> to confirm low-latency handshake and NumPy/SciPy execution environment.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="btn-inst-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveApiUrl}
                  className="btn-inst-primary"
                >
                  Save &amp; Verify Handshake
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

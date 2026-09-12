import React, { useState, useEffect } from 'react';
import ParameterPanel from './components/ParameterPanel';
import PipelineView from './components/PipelineView';
import ComparisonView from './components/ComparisonView';
import { WaveformIcon, TableIcon, SettingsIcon, MotorSenseLogo } from './components/Icons';
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
    <div className="m1k-workbench">
      {/* Precision Top Instrument Bar - MOTORSENSE Official Branding */}
      <header className="m1k-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Custom MotorSense Stator & Wave Logo */}
          <MotorSenseLogo size={36} />

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', lineHeight: 1 }}>
              <span style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '0.06em', color: '#FFFFFF' }}>
                MOTORSENSE™
              </span>
              <span style={{ fontSize: '11px', fontFamily: 'monospace', background: '#0F3C63', color: '#7DD3FC', padding: '2px 7px', borderRadius: '3px', border: '1px solid #0284C7', fontWeight: 700 }}>
                MCSA INDUSTRIAL ANALYZER v2.4
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#90CAF9', marginTop: '4px', letterSpacing: '0.02em' }}>
              Condition Monitoring &amp; Diagnostics of Machine Systems — Electrical Signature Analysis (ISO 20958)
            </div>
          </div>
        </div>

        {/* Top-Right Telemetry & Backend Connection Monitor */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
            background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #1E3A5A', borderRadius: '3px',
            fontFamily: 'monospace', fontSize: '11px', color: '#B0BEC5'
          }}>
            <span>ACQ CLOCK:</span>
            <strong style={{ color: '#00E5FF' }}>50.00 kHz</strong>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
            background: 'rgba(0, 0, 0, 0.4)', border: '1px solid #1E3A5A', borderRadius: '3px',
            fontFamily: 'monospace', fontSize: '11px', color: '#B0BEC5'
          }}>
            <span>INPUT:</span>
            <strong style={{ color: '#00E5FF' }}>3-PHASE SYNC</strong>
          </div>

          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px',
              borderRadius: '3px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '11px',
              fontWeight: 700,
              background: apiConnected === true ? '#0B2E1E' : '#3E1015',
              border: `1px solid ${apiConnected === true ? '#00E676' : '#FF1744'}`,
              color: apiConnected === true ? '#69F0AE' : '#FF8A80',
            }}
          >
            <span className={`m1k-led ${apiConnected === true ? 'm1k-led-green' : apiConnected === false ? 'm1k-led-red' : 'm1k-led-amber'}`} />
            <span>
              {apiConnected === true ? 'DSP BACKEND: ONLINE' : apiConnected === false ? 'DSP BACKEND: OFFLINE' : 'CHECKING LINK...'}
            </span>
            <SettingsIcon className="w-3 h-3 opacity-80" />
          </button>
        </div>
      </header>

      {/* Hardware Menu Toolstrip */}
      <div className="m1k-toolstrip">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button
            type="button"
            className={`btn-m1k-tab ${activeTab === 'pipeline' ? 'active' : ''}`}
            onClick={() => setActiveTab('pipeline')}
          >
            [01] OSCILLOSCOPE &amp; 7-STAGE MCSA SPECTRUM
          </button>
          <button
            type="button"
            className={`btn-m1k-tab ${activeTab === 'comparison' ? 'active' : ''}`}
            onClick={() => setActiveTab('comparison')}
          >
            [02] DUAL-CHANNEL BENCHMARK (HEALTHY vs FAULTY)
          </button>
        </div>

        <div style={{ fontSize: '12px', color: '#475569', fontFamily: 'monospace', fontWeight: 600 }}>
          STANDARDS: <strong>ISO 20958-1</strong> / <strong>IEEE Std 1415</strong>
        </div>
      </div>

      {/* Main Instrumentation Console Workspace */}
      <div className="m1k-workspace">
        {/* Left Parameter Deck */}
        <aside className="m1k-controls-deck">
          <ParameterPanel params={params} updateParam={updateParam} />
        </aside>

        {/* Central Instrument Screen Housing */}
        <main className="m1k-screen-housing">
          <div className="m1k-screen-banner">
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64B5F6' }}>
              VIRTUAL BENCH: {activeTab === 'pipeline' ? '7-STAGE MCSA DSP PIPELINE WALKTHROUGH' : 'DUAL-CHANNEL MCSA BENCHMARK'}
            </span>
            <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
              <span>ACQUISITION: <strong>50 kS/s</strong></span>
              <span>FILTER: <strong>SOS BUTTERWORTH</strong></span>
              <span>TRIGGER: <strong>AUTO</strong></span>
            </div>
          </div>

          <div className="m1k-screen-content">
            {activeTab === 'pipeline' ? (
              <PipelineView params={params} updateParam={updateParam} />
            ) : (
              <ComparisonView params={params} />
            )}
          </div>
        </main>
      </div>

      {/* Status Bar */}
      <div className="m1k-statusbar">
        <div style={{ display: 'flex', gap: '18px' }}>
          <span>STATUS: <strong>SYSTEM READY</strong></span>
          <span>WINDOW: <strong>HANNING (100% ENERGY CONSERVATION)</strong></span>
          <span>EVALUATION: <strong>ISO 20958 STATOR CURRENT SIGNATURE</strong></span>
        </div>
        <div>
          <span>MOTORSENSE DSP KERNEL v2.4</span>
        </div>
      </div>

      {/* Backend Connection Modal */}
      {showConfigModal && (
        <div className="inst-modal-backdrop">
          <div className="inst-modal-window" style={{ maxWidth: '520px' }}>
            <div style={{ padding: '12px 18px', background: '#0F172A', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, fontFamily: 'monospace' }}>
                CONFIGURE DSP BACKEND HOST URL
              </span>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '18px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '18px', fontSize: '13px', color: '#334155' }}>
              <p style={{ margin: '0 0 12px 0', lineHeight: 1.5 }}>
                Enter the remote Python FastAPI DSP processing kernel URL. Leave empty to use local relative proxy (<code>/api</code>).
              </p>

              <label className="inst-label" style={{ fontSize: '12px', fontWeight: 700, display: 'block', marginBottom: '4px' }}>
                Remote API Endpoint URL:
              </label>
              <input
                type="text"
                placeholder="https://motorsense-api.onrender.com"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
                className="inst-input"
                style={{ width: '100%', height: '34px', fontSize: '13px', padding: '4px 8px', marginBottom: '14px', border: '1px solid #CBD5E1', borderRadius: '3px' }}
              />

              <div style={{ fontSize: '12px', color: '#64748B', background: '#F8FAFC', padding: '10px', border: '1px solid #E2E8F0', borderRadius: '3px', marginBottom: '18px' }}>
                <strong>Health Verification:</strong> Checks <code>GET /api/health</code> to verify low-latency NumPy/SciPy MCSA execution environment.
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="btn-m1k"
                  style={{ height: '34px', fontSize: '12px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveApiUrl}
                  className="btn-m1k-run"
                  style={{ height: '34px', fontSize: '12px', padding: '0 14px' }}
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

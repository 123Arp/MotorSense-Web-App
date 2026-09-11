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
    <div className="m1k-workbench">
      {/* Top Bar - Analog Devices ALICE Header */}
      <header className="m1k-top-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Analog Devices Corporate Logo Mark */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="22" height="22" viewBox="0 0 100 100" fill="#FFFFFF">
              <polygon points="0,0 45,0 100,100 55,100" />
              <polygon points="55,0 100,0 80,40" />
              <polygon points="0,100 45,100 25,60" />
            </svg>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '0.12em', color: '#FFFFFF' }}>
                ANALOG DEVICES
              </div>
              <div style={{ fontSize: '8px', color: '#81D4FA', letterSpacing: '0.08em', marginTop: '1px' }}>
                AHEAD OF WHAT'S POSSIBLE™
              </div>
            </div>
          </div>

          <div style={{ width: '1px', height: '20px', background: '#335272', margin: '0 4px' }} />

          {/* Software Title */}
          <div>
            <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', color: '#FFFFFF' }}>
              ALICE M1K
            </span>
            <span style={{ fontSize: '10px', color: '#90CAF9', marginLeft: '6px', fontFamily: 'monospace' }}>
              [Active Learning Interface for Circuits &amp; Electronics · MCSA Analyzer]
            </span>
          </div>
        </div>

        {/* Top-Right Telemetry & Connection Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 8px',
            background: 'rgba(0, 0, 0, 0.3)', border: '1px solid #1E3A5A', borderRadius: '2px',
            fontFamily: 'monospace', fontSize: '10px', color: '#B0BEC5'
          }}>
            <span>M1K CLOCK:</span>
            <strong style={{ color: '#00E5FF' }}>50.000 kS/s</strong>
          </div>

          <button
            type="button"
            onClick={() => setShowConfigModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px',
              borderRadius: '2px', cursor: 'pointer', fontFamily: 'monospace', fontSize: '10px',
              background: apiConnected === true ? '#0B2E1E' : '#3E1015',
              border: `1px solid ${apiConnected === true ? '#00E676' : '#FF1744'}`,
              color: apiConnected === true ? '#69F0AE' : '#FF8A80',
            }}
          >
            <span className={`m1k-led ${apiConnected === true ? 'm1k-led-green' : apiConnected === false ? 'm1k-led-red' : 'm1k-led-amber'}`} />
            <span>
              {apiConnected === true ? 'HARDWARE/API: CONNECTED' : apiConnected === false ? 'HARDWARE/API: OFFLINE' : 'CHECKING LINK...'}
            </span>
            <SettingsIcon className="w-2.5 h-2.5 opacity-80" />
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
            OSCILLOSCOPE &amp; 7-STAGE MCSA SPECTRUM
          </button>
          <button
            type="button"
            className={`btn-m1k-tab ${activeTab === 'comparison' ? 'active' : ''}`}
            onClick={() => setActiveTab('comparison')}
          >
            DUAL-CHANNEL BENCHMARK (CHA vs CHB)
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontFamily: 'monospace', color: '#475569' }}>
          <span>CHANNEL A: <strong style={{ color: '#00B8D4' }}>{params.column} (STATOR CURRENT)</strong></span>
          <span>·</span>
          <span>TRIG: <strong style={{ color: '#059669' }}>AUTO (50 Hz)</strong></span>
          <span>·</span>
          <span>WINDOW: <strong style={{ color: '#2563EB' }}>HANN FFT</strong></span>
        </div>
      </div>

      {/* Main Workbench Workspace */}
      <div className="m1k-workspace">
        {/* Left Control Deck */}
        <aside className="m1k-controls-deck">
          <ParameterPanel params={params} updateParam={updateParam} />
        </aside>

        {/* Central Instrument Screen Housing */}
        <main className="m1k-screen-housing">
          {/* Top Screen Status Banner */}
          <div className="m1k-screen-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#00E5FF', fontWeight: 700 }}>● CH A: {params.column} (500mA/div)</span>
              <span style={{ color: '#FFB300' }}>● FILTER: 1.0 - 200.0 Hz</span>
              <span style={{ color: '#90CAF9' }}>● TIMEBASE: 50 kS/s</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>ISO 20958 COMPLIANT</span>
            </div>
          </div>

          {/* Scope / Spectrum Canvas */}
          <div className="m1k-screen-content">
            {activeTab === 'pipeline' ? (
              <PipelineView params={params} updateParam={updateParam} />
            ) : (
              <ComparisonView params={params} />
            )}
          </div>
        </main>
      </div>

      {/* Bottom Status Bar */}
      <footer className="m1k-statusbar">
        <div>
          <span>ADALM1000 MCSA INSTRUMENT SUITE</span>
          <span style={{ margin: '0 6px' }}>|</span>
          <span>ANALOG DEVICES INC.</span>
          <span style={{ margin: '0 6px' }}>|</span>
          <span>ACQ: 50.000 kHz / 9-CHANNEL SYNCHRONOUS</span>
        </div>
        <div>
          <span>ALICE M1K GUI v2.4</span>
        </div>
      </footer>

      {/* Backend URL Modal */}
      {showConfigModal && (
        <div className="inst-modal-backdrop">
          <div className="inst-modal-window">
            <div style={{ padding: '8px 12px', background: '#002B49', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace' }}>
                ANALOG DEVICES M1K HARDWARE / API CONFIGURATION
              </span>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#90CAF9', cursor: 'pointer', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ padding: '14px', fontSize: '11px', color: '#1E293B', background: '#EDEFF2' }}>
              <p style={{ margin: '0 0 10px 0', lineHeight: 1.4 }}>
                Enter the remote Render API endpoint for the MotorSense DSP kernel. Leave empty to use local proxy (<code>/api</code>).
              </p>

              <label className="inst-label">Remote API Endpoint Host URL:</label>
              <input
                type="text"
                placeholder="https://motorsense-api.onrender.com"
                value={customApiUrl}
                onChange={(e) => setCustomApiUrl(e.target.value)}
                className="m1k-input"
                style={{ marginBottom: '12px', height: '28px' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="btn-m1k"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveApiUrl}
                  className="btn-m1k btn-m1k-run"
                >
                  Save &amp; Connect Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useRef, useState, useEffect } from 'react';
import api from '../api';

const CURRENT_COLS = ['I1', 'I2', 'I3'];

export default function FileUpload({ onColumnsReady, selectedColumn, onColumnChange, onSampleSelect }) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const handleFile = async (f) => {
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.csv' && ext !== '.mat') {
      setError(`Unsupported file type '${ext}'. Please upload a .csv or .mat file.`);
      return;
    }
    setError(null); setFile(f); setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await api.post('/api/parse', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      const cols = res.data.columns || [];
      setColumns(cols);
      const best = cols.find((c) => CURRENT_COLS.includes(c)) || cols[0];
      onColumnsReady?.(cols, f.name, f, res.data.n_samples, res.data.file_size_mb);
      if (best) onColumnChange?.(best);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'File parsing error');
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Demo presets */}
      <div className="ms-demo-strip">
        <span className="ms-demo-label">⚡ Quick Demo</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="ms-btn ms-btn-sm ms-btn-green"
            onClick={() => onSampleSelect?.('FILE 1.mat')}>
            ● Healthy Motor (FILE 1)
          </button>
          <button type="button" className="ms-btn ms-btn-sm ms-btn-red"
            onClick={() => onSampleSelect?.('FILE 6.mat')}>
            ▲ Broken Rotor Bar (FILE 6)
          </button>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`ms-dropzone${dragOver ? ' dragover' : ''}${file && !error ? ' has-file' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".csv,.mat" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files[0]; if (f) handleFile(f); }} />

        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={file && !error ? 'var(--green)' : 'var(--text-3)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 8px' }}>
          {file && !error
            ? <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></>
            : <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></>
          }
        </svg>

        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '4px' }}>
          {parsing ? 'Parsing file…' : file ? file.name : 'Drop dataset here or click to browse'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
          {file
            ? `${(file.size / 1e6).toFixed(2)} MB · Click to replace`
            : 'Supports .mat and .csv · Multi-channel synchronous recordings'}
        </div>
      </div>

      {error && (
        <div className="ms-alert ms-alert-error">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </div>
      )}

      {/* Channel selector */}
      {columns.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)', marginBottom: '6px' }}>Select Channel</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {columns.map((c) => (
              <button
                key={c}
                type="button"
                className={`ms-channel-pill ${selectedColumn === c ? 'active' : ''} ${CURRENT_COLS.includes(c) ? 'current-type' : ''}`}
                onClick={() => onColumnChange?.(c)}
              >
                {c}{CURRENT_COLS.includes(c) ? ' ⚡' : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

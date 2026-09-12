import React, { useRef, useState, useEffect } from 'react';
import { UploadIcon, WaveformIcon } from './Icons';
import api from '../api';

const CURRENT_COLS = ['I1', 'I2', 'I3'];
const VOLTAGE_COLS = ['V1', 'V2', 'V3'];
const VIB_COLS = ['x', 'y', 'Z'];

export default function FileUpload({
  onColumnsReady,
  selectedColumn,
  onColumnChange,
  onSampleSelect,
  onDemoLoad,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const [samples, setSamples] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get('/api/samples')
      .then((res) => {
        if (res.data && res.data.samples) {
          setSamples(res.data.samples);
        }
      })
      .catch(() => {});
  }, []);

  const handleFile = async (f) => {
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.csv' && ext !== '.mat') {
      setError(`Unsupported file format '${ext}'. Please upload a .csv or .mat dataset.`);
      return;
    }

    setError(null);
    setFile(f);
    setParsing(true);

    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await api.post('/api/parse', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const cols = res.data.columns || [];
      setColumns(cols);

      const bestCol = cols.find((c) => CURRENT_COLS.includes(c)) || cols[0];
      if (onColumnsReady) {
        onColumnsReady(cols, f.name, f, res.data.n_samples, res.data.file_size_mb);
      }
      if (onColumnChange && bestCol) {
        onColumnChange(bestCol);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'File parsing error';
      setError(msg);
    } finally {
      setParsing(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <div style={{ padding: '2px' }}>
      {/* 1-Click Test Presets (Allows immediate testing without uploading files) */}
      <div style={{
        background: '#0D1524',
        border: '1px solid #1E2E4A',
        borderRadius: '4px',
        padding: '8px 12px',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#90CAF9', fontFamily: 'monospace', textTransform: 'uppercase' }}>
            ⚡ QUICK DEMO PRESETS:
          </span>
          <span style={{ fontSize: '11px', color: '#64748B' }}>(1-Click Instant Evaluation)</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-m1k"
            style={{ height: '28px', fontSize: '11px', background: '#092518', color: '#4ADE80', borderColor: '#15803D' }}
            onClick={() => onSampleSelect && onSampleSelect('FILE 1.mat')}
          >
            ● Healthy Motor Baseline (FILE 1)
          </button>
          <button
            type="button"
            className="btn-m1k"
            style={{ height: '28px', fontSize: '11px', background: '#2E090F', color: '#F87171', borderColor: '#991B1B' }}
            onClick={() => onSampleSelect && onSampleSelect('FILE 6.mat')}
          >
            ▲ Broken Rotor Bar Fault (FILE 6)
          </button>
        </div>
      </div>

      {/* File Ingestion Drop Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: dragOver ? '2px dashed #00E5FF' : file && !error ? '1px solid #00E676' : '1px dashed #718096',
          background: dragOver ? '#1A2942' : file && !error ? '#0E1F1A' : '#141A28',
          borderRadius: '4px',
          padding: '16px 14px',
          textAlign: 'center',
          cursor: 'pointer',
          color: '#CBD5E1',
          transition: 'all 0.15s ease'
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.mat"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files[0];
            if (f) handleFile(f);
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
          <UploadIcon className="w-5 h-5 text-sky-400" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#E2E8F0' }}>
            {file ? file.name : 'Upload Stator Current Dataset (.csv or .mat)'}
          </span>
        </div>

        <div style={{ fontSize: '11px', color: '#94A3B8' }}>
          {file
            ? `${(file.size / 1e6).toFixed(2)} MB · Drop new file or click to replace`
            : 'Supports 9-channel synchronous motor recordings at 50 kS/s or custom MCSA CSV logs'}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: '8px', padding: '6px 10px', background: '#3B0F15', border: '1px solid #FF1744', color: '#FF8A80', fontSize: '12px', fontFamily: 'monospace', borderRadius: '3px' }}>
          {error}
        </div>
      )}

      {/* Synchronous Channel Selector Strip */}
      {columns.length > 0 && (
        <div style={{ marginTop: '10px', background: '#0F1626', border: '1px solid #23314A', borderRadius: '4px', padding: '8px 10px' }}>
          <div style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 800, color: '#90CAF9', marginBottom: '6px', textTransform: 'uppercase' }}>
            SELECT ACTIVE ANALYSIS CURRENT CHANNEL:
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {columns.map((c) => {
              const isCurrent = CURRENT_COLS.includes(c);
              const isSelected = selectedColumn === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => onColumnChange && onColumnChange(c)}
                  className="btn-m1k"
                  style={{
                    height: '26px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    background: isSelected ? '#00E5FF' : isCurrent ? '#162238' : '#0F1420',
                    color: isSelected ? '#000000' : isCurrent ? '#38BDF8' : '#94A3B8',
                    borderColor: isSelected ? '#00E5FF' : isCurrent ? '#2563EB' : '#334155',
                  }}
                >
                  {c} {isCurrent && '(Phase Current)'}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

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
  label = 'DATASET INGESTION & CHANNEL SELECTION',
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
      setError(`Unsupported file format '${ext}'. Please upload a standard engineering .csv or .mat file.`);
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
      const msg = err?.response?.data?.detail || err.message || 'Data parse error';
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
    <div>
      {label && (
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
          {label}
        </div>
      )}

      {/* Upload Zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: dragOver ? '2px dashed #0F4C81' : file && !error ? '2px solid #15803D' : '2px dashed #CBD5E1',
          background: dragOver ? '#EBF3FA' : file && !error ? '#F0FDF4' : '#F8FAFC',
          borderRadius: '2px',
          padding: '24px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.15s ease-in-out'
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
            e.target.value = '';
          }}
        />

        {parsing ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <div className="inst-spinner" style={{ width: '28px', height: '28px' }} />
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#1E293B', fontFamily: 'monospace' }}>
              STREAMING MULTI-CHANNEL DATASTREAM...
            </div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>
              Validating 9 synchronous channels at 50 000 samples/sec
            </div>
          </div>
        ) : file && !error ? (
          <div>
            <div style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#15803D', marginBottom: '4px' }}>
              [FILE LOADED SUCCESSFULLY]
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
              {file.name}
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
              Size: {(file.size / 1e6).toFixed(2)} MB · Click or drag new file to replace
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <UploadIcon className="w-8 h-8 text-slate-400" />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
              Select or Drag Motor Current Signal Recording
            </div>
            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', fontFamily: 'monospace' }}>
              Accepts .CSV or MATLAB .MAT (v5/v7 or v7.3 HDF5, up to 200 MB)
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="inst-banner inst-banner-alert" style={{ marginTop: '10px' }}>
          <div>
            <strong>Ingestion Failure:</strong> {error}
          </div>
        </div>
      )}

      {/* Bundled Benchmark Data Shortcut */}
      {samples.length > 0 && onSampleSelect && (
        <div style={{ marginTop: '10px', padding: '8px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Reference Benchmark Datasets:
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {samples.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSampleSelect(s.id);
                }}
                className="btn-inst-secondary"
                style={{ fontSize: '11px', fontFamily: 'monospace' }}
              >
                <WaveformIcon className="w-3.5 h-3.5 text-blue-700" />
                {s.filename} ({s.size_mb} MB)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Channel Matrix Picker */}
      {columns.length > 0 && !error && (
        <div style={{ marginTop: '14px', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '2px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Available Ingested Channels (Synchronized 50 kHz):</span>
            <span style={{ color: '#0F4C81', fontWeight: 700 }}>MCSA Target: Current (I1 / I2 / I3)</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {columns.map((col) => {
              const isCurrent = CURRENT_COLS.includes(col);
              const isVoltage = VOLTAGE_COLS.includes(col);
              const isVib = VIB_COLS.includes(col);
              const isSelected = col === selectedColumn;

              let typeLabel = isCurrent ? 'CURRENT' : isVoltage ? 'VOLTAGE' : isVib ? 'VIBRATION' : 'AUX';

              return (
                <button
                  key={col}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onColumnChange) onColumnChange(col);
                  }}
                  style={{
                    padding: '4px 10px',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    borderRadius: '2px',
                    border: isSelected ? '2px solid #0F4C81' : '1px solid #CBD5E1',
                    background: isSelected ? '#0F4C81' : '#FFFFFF',
                    color: isSelected ? '#FFFFFF' : isCurrent ? '#0F172A' : '#64748B',
                    fontWeight: isSelected ? 700 : isCurrent ? 600 : 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <span>{col}</span>
                  <span style={{ fontSize: '8px', opacity: 0.8, textTransform: 'uppercase' }}>[{typeLabel}]</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

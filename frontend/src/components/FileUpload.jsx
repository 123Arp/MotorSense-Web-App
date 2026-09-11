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
  label = 'INPUT STREAM & CHANNEL SELECTION',
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
      {/* File Ingestion Drop Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: dragOver ? '2px dashed #00E5FF' : file && !error ? '1px solid #00E676' : '1px dashed #718096',
          background: dragOver ? '#1A2942' : file && !error ? '#0E1F1A' : '#141A28',
          borderRadius: '3px',
          padding: '16px 12px',
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
            e.target.value = '';
          }}
        />

        {parsing ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
            <div className="inst-spinner" style={{ width: '22px', height: '22px', borderTopColor: '#00E5FF' }} />
            <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#00E5FF', fontWeight: 700 }}>
              STREAMING MULTI-CHANNEL BUFFER (50 kHz)...
            </div>
          </div>
        ) : file && !error ? (
          <div>
            <div style={{ color: '#00E676', fontSize: '11px', fontFamily: 'monospace', fontWeight: 700 }}>
              ● BUFFER READY: {file.name}
            </div>
            <div style={{ fontSize: '10px', color: '#94A3B8', fontFamily: 'monospace', marginTop: '2px' }}>
              Size: {(file.size / 1e6).toFixed(2)} MB · Click or drop file to reload
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              <UploadIcon className="w-5 h-5 text-cyan-400" />
            </div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#F1F5F9', letterSpacing: '0.02em' }}>
              LOAD MOTOR SIGNAL DATA (.CSV / .MAT)
            </div>
            <div style={{ fontSize: '10px', color: '#64B5F6', fontFamily: 'monospace', marginTop: '2px' }}>
              50 kHz 9-Channel Synchronized Data Stream
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginTop: '6px', background: '#3E1010', border: '1px solid #FF1744', color: '#FF8A80', padding: '6px 8px', borderRadius: '2px', fontSize: '10px', fontFamily: 'monospace' }}>
          ERROR: {error}
        </div>
      )}

      {/* Preset Benchmarks */}
      {samples.length > 0 && onSampleSelect && (
        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#111726', padding: '4px 8px', border: '1px solid #23314A', borderRadius: '2px' }}>
          <span style={{ fontSize: '10px', fontFamily: 'monospace', color: '#90CAF9', fontWeight: 700 }}>
            BENCHMARK SAMPLES:
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            {samples.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSampleSelect(s.id);
                }}
                className="btn-m1k"
                style={{ height: '20px', fontSize: '9px', padding: '0 6px', fontFamily: 'monospace', background: '#19263D', color: '#00E5FF', borderColor: '#2E4870' }}
              >
                {s.filename}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Channel Strip Matrix */}
      {columns.length > 0 && !error && (
        <div style={{ marginTop: '8px', background: '#111726', border: '1px solid #23314A', padding: '6px 8px', borderRadius: '2px' }}>
          <div style={{ fontSize: '9px', fontFamily: 'monospace', fontWeight: 700, color: '#90CAF9', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
            <span>ACTIVE CHANNEL ROUTING:</span>
            <span style={{ color: '#00E5FF' }}>MCSA: CURRENT (I1/I2/I3)</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {columns.map((col) => {
              const isCurr = CURRENT_COLS.includes(col);
              const isSelected = col === selectedColumn;

              return (
                <button
                  key={col}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onColumnChange) onColumnChange(col);
                  }}
                  style={{
                    height: '22px',
                    padding: '0 6px',
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    borderRadius: '2px',
                    border: isSelected ? '1px solid #00E5FF' : '1px solid #263852',
                    background: isSelected ? '#00E5FF' : isCurr ? '#192538' : '#0F1522',
                    color: isSelected ? '#000000' : isCurr ? '#E0F7FA' : '#64748B',
                    fontWeight: isSelected || isCurr ? 700 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {col}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

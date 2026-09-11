import React, { useRef, useState, useEffect } from 'react';
import api from '../api';

const CURRENT_COLS = ['I1', 'I2', 'I3'];

export default function FileUpload({
  onColumnsReady,
  selectedColumn,
  onColumnChange,
  onSampleSelect,
  label = 'Load Motor Signal Data',
  accent = '#1A56DB',
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
      setError(`Unsupported file format '${ext}'. Please select a .csv or .mat file.`);
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
      const msg = err?.response?.data?.detail || err.message || 'File parsing failed';
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
      {label && <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">{label}</div>}

      <div
        className={`upload-zone ${dragOver ? 'drag-over' : ''} ${file && !error ? 'has-file' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
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
            <div className="spinner" style={{ borderTopColor: accent, width: 28, height: 28 }} />
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#4B5563' }}>Parsing file headers...</div>
            <div style={{ fontSize: '11px', color: '#9CA3AF' }}>Verifying 50 kHz multi-sensor channels</div>
          </div>
        ) : file && !error ? (
          <div>
            <div style={{ color: '#057A55', fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>✓</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#111928' }}>{file.name}</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
              {(file.size / 1e6).toFixed(1)} MB · Click or drop another file to replace
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '28px', color: '#9CA3AF', marginBottom: '8px' }}>📥</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937' }}>Drag & drop motor signal file here</div>
            <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '4px' }}>
              Supports <strong>.csv</strong> and <strong>.mat</strong> (MATLAB v5/v7 or v7.3 HDF5, up to ~200 MB)
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="banner banner-error" style={{ marginTop: '8px' }}>
          <span>⚠</span>
          <div><strong>Error:</strong> {error}</div>
        </div>
      )}

      {/* Bundled Samples Shortcut */}
      {samples.length > 0 && onSampleSelect && (
        <div style={{ marginTop: '10px', padding: '8px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', fontWeight: 500, color: '#4B5563' }}>Bundled test datasets:</span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {samples.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSampleSelect(s.id);
                }}
                className="btn-ghost"
                style={{ fontSize: '11px', background: '#FFFFFF', color: '#1A56DB', borderColor: '#BFDBFE' }}
              >
                Load {s.filename} ({s.size_mb} MB)
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Column picker */}
      {columns.length > 0 && !error && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
            <span>Select Channel to Analyze:</span>
            <span style={{ fontSize: '10px', color: '#6B7280', textTransform: 'none', fontWeight: 400 }}>I1, I2, I3 = Stator current</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                    padding: '4px 10px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    borderRadius: '4px',
                    border: isSelected ? '2px solid #1A56DB' : '1px solid #D1D5DB',
                    background: isSelected ? '#EBF0FF' : '#FFFFFF',
                    color: isSelected ? '#1A56DB' : isCurr ? '#111928' : '#9CA3AF',
                    fontWeight: isSelected ? 700 : isCurr ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {col} {isCurr && <span style={{ color: '#1A56DB', fontWeight: 'bold', marginLeft: '2px' }}>●</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

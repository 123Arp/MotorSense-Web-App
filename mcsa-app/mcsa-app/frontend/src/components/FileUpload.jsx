import { useRef, useState } from "react";
import axios from "axios";

const CURRENT_COLS = ["I1", "I2", "I3"];
const ALLOWED_TYPES = [".csv", ".mat"];

/**
 * FileUpload component.
 * Props:
 *   onColumnsReady(columns, filename) — called after successful parse
 *   selectedColumn / onColumnChange   — controlled column selection
 *   label                             — heading text
 *   accent                            — color (default: "#1A56DB")
 */
export default function FileUpload({
  onColumnsReady,
  selectedColumn,
  onColumnChange,
  label = "Upload File",
  accent = "#1A56DB",
  compact = false,
}) {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [columns, setColumns] = useState([]);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef();

  const handleFile = async (f) => {
    if (!f) return;
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED_TYPES.includes(ext)) {
      setError(`Unsupported file type: ${ext}. Please use .csv or .mat`);
      return;
    }
    setError(null);
    setFile(f);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await axios.post("/api/parse", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300_000,
      });
      const cols = res.data.columns || [];
      setColumns(cols);
      // Auto-select first current column found
      const autoCol = cols.find((c) => CURRENT_COLS.includes(c)) || cols[0];
      onColumnsReady && onColumnsReady(cols, f.name, f, res.data.n_samples);
      onColumnChange && onColumnChange(autoCol);
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || "Parse failed";
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

  const onInputChange = (e) => {
    const f = e.target.files[0];
    if (f) handleFile(f);
    e.target.value = "";
  };

  const zone_class = `upload-zone${dragOver ? " drag-over" : ""}${file && !error ? " has-file" : ""}`;

  return (
    <div>
      {!compact && (
        <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>
          {label}
        </div>
      )}

      <div
        className={zone_class}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{ cursor: "pointer" }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.mat"
          style={{ display: "none" }}
          onChange={onInputChange}
        />
        {parsing ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
            <div className="spinner" style={{ width: 28, height: 28, borderTopColor: accent }} />
            <div style={{ fontSize: "0.875rem", color: "#6B7280" }}>Parsing file…</div>
          </div>
        ) : file && !error ? (
          <div>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.25rem" }}>✓</div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#057A55" }}>{file.name}</div>
            <div style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "0.2rem" }}>
              {(file.size / 1e6).toFixed(1)} MB · Click to replace
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: "2rem", color: "#9CA3AF", marginBottom: "0.5rem" }}>⬆</div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>
              Drag &amp; drop or click to upload
            </div>
            <div style={{ fontSize: "0.75rem", color: "#9CA3AF", marginTop: "0.25rem" }}>
              .csv or .mat (up to ~200 MB)
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="banner banner-error" style={{ marginTop: "0.5rem" }}>
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      {/* Column picker */}
      {columns.length > 0 && !error && (
        <div style={{ marginTop: "0.75rem" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>
            Select current channel to analyze
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {columns.map((col) => {
              const isCurrent = CURRENT_COLS.includes(col);
              const isSelected = col === selectedColumn;
              return (
                <button
                  key={col}
                  onClick={(e) => { e.stopPropagation(); onColumnChange && onColumnChange(col); }}
                  style={{
                    padding: "0.3rem 0.65rem",
                    border: isSelected ? `2px solid ${accent}` : "1px solid #D1D5DB",
                    borderRadius: "4px",
                    background: isSelected ? "#EBF0FF" : "#fff",
                    color: isSelected ? accent : isCurrent ? "#374151" : "#9CA3AF",
                    fontFamily: "JetBrains Mono, monospace",
                    fontSize: "0.8rem",
                    fontWeight: isSelected ? 700 : 400,
                    cursor: "pointer",
                  }}
                >
                  {col}
                  {isCurrent && !isSelected && (
                    <span style={{ marginLeft: "0.3rem", fontSize: "0.65rem", color: "#1A56DB" }}>●</span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#9CA3AF", marginTop: "0.3rem" }}>
            ● = current channel (I1/I2/I3 recommended for MCSA)
          </div>
        </div>
      )}
    </div>
  );
}

"""
FastAPI backend for the MCSA Web App.
Endpoints:
  GET  /api/health         — liveness check
  POST /api/parse          — upload file, return column list + metadata
  POST /api/analyze        — run full DSP pipeline on one file
  POST /api/compare        — run pipeline on two files (healthy vs faulty)
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tempfile
import os
import json
import logging

from file_parser import parse_file, get_column_signal
from dsp_pipeline import run_full_pipeline

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MotorSense API",
    description="MotorSense — MCSA DSP pipeline backend",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_EXTS = {".csv", ".mat"}


def _save_upload(upload: UploadFile, content: bytes) -> str:
    """Save uploaded content to a temp file and return its path."""
    ext = os.path.splitext(upload.filename or "")[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, detail=f"Unsupported file type: {ext}. Use .csv or .mat")
    tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    tmp.write(content)
    tmp.close()
    return tmp.name


# -----------------------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/api/parse")
async def parse_endpoint(file: UploadFile = File(...)):
    """Upload a file and return its column list + basic metadata."""
    content = await file.read()
    tmp_path = _save_upload(file, content)
    try:
        df, columns = parse_file(tmp_path)
        return {
            "filename": file.filename,
            "columns": columns,
            "n_samples": len(df),
            "file_size_mb": round(len(content) / 1e6, 2),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, detail=str(e))
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


@app.post("/api/analyze")
async def analyze_endpoint(
    file: UploadFile = File(...),
    params: str = Form(...),
):
    """Run the full MCSA DSP pipeline on an uploaded file."""
    try:
        params_dict = json.loads(params)
    except Exception:
        raise HTTPException(400, detail="params must be valid JSON")

    content = await file.read()
    tmp_path = _save_upload(file, content)

    try:
        df, columns = parse_file(tmp_path)
        column = params_dict.get("column", "I1")

        if column not in columns:
            raise HTTPException(
                400,
                detail=f"Column '{column}' not found. Available: {columns}",
            )

        fs = float(params_dict.get("fs", 50000.0))
        sig = get_column_signal(df, column)
        del df  # free memory

        logger.info(
            f"Analyzing '{file.filename}' col={column} "
            f"N={len(sig)} fs={fs} Hz"
        )
        results = run_full_pipeline(sig, fs, params_dict)
        return JSONResponse(content=results)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Pipeline error")
        raise HTTPException(500, detail=f"Analysis error: {e}")
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


@app.post("/api/compare")
async def compare_endpoint(
    healthy_file: UploadFile = File(...),
    faulty_file: UploadFile = File(...),
    params: str = Form(...),
):
    """Run the pipeline on two files and return both result sets."""
    try:
        params_dict = json.loads(params)
    except Exception:
        raise HTTPException(400, detail="params must be valid JSON")

    fs = float(params_dict.get("fs", 50000.0))
    results = {}

    for label, upload in [("healthy", healthy_file), ("faulty", faulty_file)]:
        content = await upload.read()
        tmp_path = _save_upload(upload, content)
        try:
            df, columns = parse_file(tmp_path)
            col = params_dict.get(f"{label}_column", params_dict.get("column", "I1"))
            if col not in columns:
                col = columns[0]
            sig = get_column_signal(df, col)
            del df
            res = run_full_pipeline(sig, fs, params_dict)
            res["used_column"] = col
            res["filename"] = upload.filename
            results[label] = res
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, detail=f"Error processing {label} file: {e}")
        finally:
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    return JSONResponse(content=results)

"""
FastAPI Backend for MotorSense - Motor Current Signature Analysis (MCSA).
Provides endpoints for file inspection, DSP pipeline execution, and comparison.
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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("motorsense")

app = FastAPI(
    title="MotorSense API",
    description="Motor Current Signature Analysis (MCSA) DSP Pipeline Backend",
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


def _save_upload_to_temp(upload: UploadFile) -> str:
    ext = os.path.splitext(upload.filename or "")[1].lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, detail=f"Unsupported file type '{ext}'. Please upload a .csv or .mat file.")
    tmp = tempfile.NamedTemporaryFile(suffix=ext, delete=False)
    try:
        while True:
            chunk = upload.file.read(1024 * 1024 * 8)
            if not chunk:
                break
            tmp.write(chunk)
    finally:
        tmp.close()
    return tmp.name


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "app": "MotorSense",
        "service": "MCSA DSP Analysis Backend",
        "version": "1.0.0",
    }


@app.get("/api/samples")
def list_samples():
    """List bundled sample dataset files available for instant demonstration."""
    sample_dir = os.path.join(os.path.dirname(__file__), "..", "data_test")
    samples = []
    if os.path.exists(sample_dir):
        for fname in sorted(os.listdir(sample_dir)):
            if fname.lower().endswith((".mat", ".csv")):
                fpath = os.path.join(sample_dir, fname)
                samples.append({
                    "id": fname,
                    "filename": fname,
                    "size_mb": round(os.path.getsize(fpath) / 1e6, 2),
                    "description": "0.2 kW Motor test recording (50 kHz, 9-ch)",
                })
    return {"samples": samples}


@app.post("/api/sample/analyze")
def analyze_sample(
    sample_id: str = Form(...),
    params: str = Form(...),
):
    """Run full DSP pipeline on a bundled sample file without client-side upload."""
    sample_dir = os.path.join(os.path.dirname(__file__), "..", "data_test")
    file_path = os.path.join(sample_dir, sample_id)
    if not os.path.exists(file_path):
        raise HTTPException(404, detail=f"Sample file '{sample_id}' not found")

    try:
        params_dict = json.loads(params)
    except Exception:
        raise HTTPException(400, detail="Invalid JSON in params field")

    try:
        df, columns = parse_file(file_path)
        column = params_dict.get("column", "I1")
        if column not in columns:
            column = [c for c in columns if c.startswith("I")][0] if any(c.startswith("I") for c in columns) else columns[0]

        fs = float(params_dict.get("fs", 50000.0))
        sig = get_column_signal(df, column)
        del df

        logger.info(f"Analyzing sample '{sample_id}' col={column} N={len(sig)} fs={fs}")
        results = run_full_pipeline(sig, fs, params_dict)
        results["filename"] = sample_id
        results["used_column"] = column
        return JSONResponse(content=results)
    except Exception as e:
        logger.exception("Sample analysis error")
        raise HTTPException(500, detail=f"Error analyzing sample: {str(e)}")


@app.post("/api/parse")
async def parse_endpoint(file: UploadFile = File(...)):
    """Upload a file, detect column headers and sample metadata."""
    tmp_path = _save_upload_to_temp(file)
    try:
        size_bytes = os.path.getsize(tmp_path)
        df, columns = parse_file(tmp_path)
        return {
            "filename": file.filename,
            "columns": columns,
            "n_samples": int(len(df)),
            "file_size_mb": round(size_bytes / 1e6, 2),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Parse failed")
        raise HTTPException(400, detail=f"Could not parse file: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/api/analyze")
async def analyze_endpoint(
    file: UploadFile = File(...),
    params: str = Form(...),
):
    """Run full 7-stage MCSA DSP pipeline on uploaded file."""
    try:
        params_dict = json.loads(params)
    except Exception:
        raise HTTPException(400, detail="Invalid JSON in params parameter")

    tmp_path = _save_upload_to_temp(file)
    try:
        df, columns = parse_file(tmp_path)
        column = params_dict.get("column", "I1")
        if column not in columns:
            raise HTTPException(400, detail=f"Selected column '{column}' not in file. Found: {columns}")

        fs = float(params_dict.get("fs", 50000.0))
        sig = get_column_signal(df, column)
        del df

        logger.info(f"Running DSP pipeline on '{file.filename}', column='{column}', {len(sig)} samples at {fs} Hz")
        results = run_full_pipeline(sig, fs, params_dict)
        results["filename"] = file.filename
        results["used_column"] = column
        return JSONResponse(content=results)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Analysis error")
        raise HTTPException(500, detail=f"Analysis pipeline error: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/api/compare")
async def compare_endpoint(
    healthy_file: UploadFile = File(...),
    faulty_file: UploadFile = File(...),
    params: str = Form(...),
):
    """Run DSP pipeline on healthy and faulty files for side-by-side comparison."""
    try:
        params_dict = json.loads(params)
    except Exception:
        raise HTTPException(400, detail="Invalid JSON in params parameter")

    fs = float(params_dict.get("fs", 50000.0))
    comparison_results = {}

    for label, upload in [("healthy", healthy_file), ("faulty", faulty_file)]:
        tmp_path = _save_upload_to_temp(upload)
        try:
            df, columns = parse_file(tmp_path)
            col = params_dict.get(f"{label}_column", params_dict.get("column", "I1"))
            if col not in columns:
                col = [c for c in columns if c.startswith("I")][0] if any(c.startswith("I") for c in columns) else columns[0]
            sig = get_column_signal(df, col)
            del df

            res = run_full_pipeline(sig, fs, params_dict)
            res["filename"] = upload.filename
            res["used_column"] = col
            comparison_results[label] = res
        finally:
            if os.path.exists(tmp_path):
                os.unlink(tmp_path)

    return JSONResponse(content=comparison_results)

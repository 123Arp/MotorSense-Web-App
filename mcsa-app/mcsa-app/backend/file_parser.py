"""
File parser for MCSA app.
Supports CSV (with/without header, auto-detect) and MATLAB .mat files
(legacy scipy.io.loadmat format and v7.3+ HDF5 via h5py).
"""

import numpy as np
import pandas as pd
import os
import logging
from typing import Tuple, List

logger = logging.getLogger(__name__)

EXPECTED_COLUMNS = ['x', 'y', 'Z', 'I1', 'I2', 'I3', 'V1', 'V2', 'V3']


def parse_csv(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """
    Parse CSV. Auto-detects presence of a header row.
    If no header and 9 columns, assigns the expected column names.
    """
    with open(file_path, 'r', errors='replace') as f:
        first_line = f.readline().strip()

    # Header present if first token contains alphabetic characters
    first_token = first_line.split(',')[0].strip()
    has_header = any(c.isalpha() for c in first_token)

    if has_header:
        df = pd.read_csv(file_path, header=0, low_memory=False)
        df.columns = [c.strip() for c in df.columns]
    else:
        df = pd.read_csv(file_path, header=None, low_memory=False)
        if len(df.columns) == 9:
            df.columns = EXPECTED_COLUMNS
        elif len(df.columns) == 1:
            # Single-column file — treat as current signal
            df.columns = ['I1']
        else:
            df.columns = [f"ch{i}" for i in range(len(df.columns))]

    # Coerce all columns to numeric
    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    df.dropna(how='all', inplace=True)
    return df, list(df.columns)


def parse_mat_legacy(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """Parse legacy MATLAB .mat file with scipy.io.loadmat."""
    import scipy.io
    mat = scipy.io.loadmat(file_path, squeeze_me=True)
    data_keys = [k for k in mat.keys() if not k.startswith('_')]

    for key in data_keys:
        val = mat[key]
        if not isinstance(val, np.ndarray):
            continue
        val = np.atleast_2d(val)
        if val.shape[1] == 9:
            df = pd.DataFrame(val.astype(float), columns=EXPECTED_COLUMNS)
            return df, EXPECTED_COLUMNS
        if val.shape[0] == 9:
            df = pd.DataFrame(val.T.astype(float), columns=EXPECTED_COLUMNS)
            return df, EXPECTED_COLUMNS

    # Fallback: build DataFrame from all numeric scalar/vector keys
    arrays = {}
    for key in data_keys:
        val = mat[key]
        if isinstance(val, np.ndarray) and val.ndim >= 1 and val.dtype.kind in ('f', 'i', 'u'):
            arrays[key] = val.flatten()
    if arrays:
        min_len = min(len(v) for v in arrays.values())
        df = pd.DataFrame({k: v[:min_len] for k, v in arrays.items()})
        return df, list(arrays.keys())

    raise ValueError("Could not extract numeric matrix from legacy .mat file")


def parse_mat_h5(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """Parse MATLAB v7.3+ .mat file (HDF5 format) with h5py."""
    import h5py
    with h5py.File(file_path, 'r') as f:
        keys = list(f.keys())

        # Look for a (N,9) or (9,N) dataset
        for key in keys:
            item = f[key]
            if isinstance(item, h5py.Dataset):
                arr = item[()].astype(float)
                if arr.ndim == 2 and arr.shape[1] == 9:
                    df = pd.DataFrame(arr, columns=EXPECTED_COLUMNS)
                    return df, EXPECTED_COLUMNS
                if arr.ndim == 2 and arr.shape[0] == 9:
                    df = pd.DataFrame(arr.T, columns=EXPECTED_COLUMNS)
                    return df, EXPECTED_COLUMNS

        # Fallback: individual numeric datasets
        arrays = {}
        for key in keys:
            item = f[key]
            if isinstance(item, h5py.Dataset):
                arr = item[()]
                if isinstance(arr, np.ndarray) and arr.dtype.kind in ('f', 'i', 'u'):
                    arrays[key] = arr.flatten()

        if not arrays:
            raise ValueError("No numeric datasets found in HDF5 .mat file")

        min_len = min(len(v) for v in arrays.values())
        df = pd.DataFrame({k: v[:min_len].astype(float) for k, v in arrays.items()})
        return df, list(arrays.keys())


def parse_mat(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """Try legacy .mat first; fall back to HDF5 for v7.3+ files."""
    try:
        return parse_mat_legacy(file_path)
    except Exception as e:
        logger.info(f"Legacy .mat parse failed ({e}), trying HDF5...")
        try:
            return parse_mat_h5(file_path)
        except Exception as e2:
            raise ValueError(
                f"Cannot parse .mat — legacy error: {e}; HDF5 error: {e2}"
            )


def parse_file(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """Dispatch to correct parser based on file extension."""
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.csv':
        return parse_csv(file_path)
    elif ext == '.mat':
        return parse_mat(file_path)
    else:
        raise ValueError(f"Unsupported format: {ext}. Use .csv or .mat")


def get_column_signal(df: pd.DataFrame, column: str) -> np.ndarray:
    """Extract a single column as a clean float64 numpy array."""
    if column not in df.columns:
        raise ValueError(
            f"Column '{column}' not found. Available: {list(df.columns)}"
        )
    arr = df[column].values.astype(np.float64)
    arr = arr[np.isfinite(arr)]
    if len(arr) == 0:
        raise ValueError(f"Column '{column}' contains no valid numeric data")
    return arr

"""
File Parser for MotorSense MCSA app.
Supports CSV (auto-header detection) and MATLAB .mat files
(scipy.io.loadmat for v5/v7 legacy and h5py for v7.3+ HDF5 format).
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
    Parse CSV with auto-detection of header row.
    Handles comma or whitespace delimiters, assigns standard 9-channel names
    if 9 unlabeled numeric columns are found.
    """
    with open(file_path, 'r', errors='replace') as f:
        first_line = f.readline().strip()

    first_token = first_line.split(',')[0].strip()
    has_header = any(c.isalpha() for c in first_token)

    if has_header:
        df = pd.read_csv(file_path, header=0, low_memory=False)
        df.columns = [str(c).strip() for c in df.columns]
    else:
        df = pd.read_csv(file_path, header=None, low_memory=False)
        if len(df.columns) == 9:
            df.columns = EXPECTED_COLUMNS
        elif len(df.columns) == 1:
            df.columns = ['I1']
        else:
            df.columns = [f"ch{i}" for i in range(len(df.columns))]

    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    df.dropna(how='all', inplace=True)
    return df, list(df.columns)


def parse_mat_legacy(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """Parse legacy MATLAB .mat file with scipy.io.loadmat."""
    import scipy.io
    mat = scipy.io.loadmat(file_path, squeeze_me=True)
    data_keys = [k for k in mat.keys() if not k.startswith('_')]

    # Look for (N, 9) or (9, N) matrix
    for key in data_keys:
        val = mat[key]
        if isinstance(val, np.ndarray):
            arr = np.atleast_2d(val)
            if arr.shape[1] == 9:
                df = pd.DataFrame(arr.astype(float), columns=EXPECTED_COLUMNS)
                return df, EXPECTED_COLUMNS
            if arr.shape[0] == 9:
                df = pd.DataFrame(arr.T.astype(float), columns=EXPECTED_COLUMNS)
                return df, EXPECTED_COLUMNS

    # Fallback: combine numeric 1D/2D arrays
    arrays = {}
    for key in data_keys:
        val = mat[key]
        if isinstance(val, np.ndarray) and val.ndim >= 1 and val.dtype.kind in ('f', 'i', 'u'):
            arrays[key] = val.flatten()
    if arrays:
        min_len = min(len(v) for v in arrays.values())
        df = pd.DataFrame({k: v[:min_len].astype(float) for k, v in arrays.items()})
        return df, list(arrays.keys())

    raise ValueError("Could not find numeric data matrix in legacy .mat file")


def parse_mat_h5(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """Parse MATLAB v7.3+ .mat file (HDF5 format) with h5py."""
    import h5py
    with h5py.File(file_path, 'r') as f:
        keys = list(f.keys())
        for key in keys:
            item = f[key]
            if isinstance(item, h5py.Dataset):
                arr = item[()].astype(float)
                if arr.ndim == 2 and arr.shape[1] == 9:
                    return pd.DataFrame(arr, columns=EXPECTED_COLUMNS), EXPECTED_COLUMNS
                if arr.ndim == 2 and arr.shape[0] == 9:
                    return pd.DataFrame(arr.T, columns=EXPECTED_COLUMNS), EXPECTED_COLUMNS

        arrays = {}
        for key in keys:
            item = f[key]
            if isinstance(item, h5py.Dataset):
                arr = item[()]
                if isinstance(arr, np.ndarray) and arr.dtype.kind in ('f', 'i', 'u'):
                    arrays[key] = arr.flatten()

        if arrays:
            min_len = min(len(v) for v in arrays.values())
            df = pd.DataFrame({k: v[:min_len].astype(float) for k, v in arrays.items()})
            return df, list(arrays.keys())

    raise ValueError("No numeric data found in HDF5 .mat file")


def parse_mat(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """Try legacy loadmat first, fallback to h5py for v7.3+ files."""
    try:
        return parse_mat_legacy(file_path)
    except Exception as e1:
        try:
            return parse_mat_h5(file_path)
        except Exception as e2:
            raise ValueError(f"Failed to parse .mat file. Legacy error: {e1}; HDF5 error: {e2}")


def parse_file(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    ext = os.path.splitext(file_path)[1].lower()
    if ext == '.csv':
        return parse_csv(file_path)
    elif ext == '.mat':
        return parse_mat(file_path)
    else:
        raise ValueError(f"Unsupported format '{ext}'. Expected .csv or .mat")


def get_column_signal(df: pd.DataFrame, column: str) -> np.ndarray:
    if column not in df.columns:
        raise ValueError(f"Column '{column}' not found. Available columns: {list(df.columns)}")
    arr = df[column].values.astype(np.float64)
    arr = arr[np.isfinite(arr)]
    if len(arr) == 0:
        raise ValueError(f"Column '{column}' contains no valid finite numeric values")
    return arr

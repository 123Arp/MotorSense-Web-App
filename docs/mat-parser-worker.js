'use strict';
/**
 * mat-parser-worker.js — Universal MATLAB .mat File Parser (Web Worker)
 *
 * Supports ANY MATLAB .mat file:
 *   • Legacy Level-5 MATLAB binary (.mat)
 *   • MATLAB v7.3 HDF5 (.mat) via h5wasm
 *   • Generic multi-column 2D matrices (N×M or M×N for any channel count M)
 *   • Auto-maps standard 9-channel benchmark layouts (x, y, Z, I1, I2, I3, V1, V2, V3)
 *   • Auto-maps 3-phase current layouts (I1, I2, I3)
 *   • Auto-maps any generic multi-column matrix (Col 1, Col 2, ...)
 *   • Dynamic discovery of all 1D/2D numeric variables
 */

var EXPECTED_COLUMNS_9 = EXPECTED_COLUMNS_9 || ['x', 'y', 'Z', 'I1', 'I2', 'I3', 'V1', 'V2', 'V3'];
const EXPECTED_COLUMNS_3 = ['I1', 'I2', 'I3'];

var CURRENT_KEYWORDS = CURRENT_KEYWORDS || [
    'i1', 'ia', 'current', 'curr', 'stator', 'phase a', 'phase_a', 'phasea',
    'i_1', 'i_a', 'i2', 'ib', 'i3', 'ic', 'amp'
];

// ─── Type Constants ───────────────────────────────────────────────────────────

const MI = {
    INT8:       1,  UINT8:      2,
    INT16:      3,  UINT16:     4,
    INT32:      5,  UINT32:     6,
    SINGLE:     7,  DOUBLE:     9,
    INT64:     12,  UINT64:    13,
    MATRIX:    14,  COMPRESSED: 15,
    UTF8:      16,  UTF16:     17
};

const MX_NUMERIC_CLASSES = new Set([6,7,8,9,10,11,12,13,14,15]);

// ─── Format Detection ─────────────────────────────────────────────────────────

function detectMATVersion(buffer) {
    if (buffer.byteLength < 128) return 'unknown';
    const view = new DataView(buffer);
    const v0   = view.getUint8(124);
    const v1   = view.getUint8(125);
    if (v0 === 0x02 && v1 === 0x00) return 'v73';
    if ((v0 === 0x01 && v1 === 0x00) || (v0 === 0x00 && v1 === 0x01)) return 'v5';
    const desc = String.fromCharCode(...new Uint8Array(buffer, 0, 60));
    if (desc.includes('HDF5') || desc.includes('7.3')) return 'v73';
    return 'v5';
}

function isLittleEndian(view) {
    return view.getUint8(126) === 0x49; // 'I' for Intel
}

// ─── Low-Level Binary Readers ─────────────────────────────────────────────────

function readElements(view, typeId, byteOffset, numElements, le) {
    const out = new Float64Array(numElements);
    switch (typeId) {
        case MI.INT8:   for (let i=0;i<numElements;i++) out[i]=view.getInt8(byteOffset+i); break;
        case MI.UINT8:  for (let i=0;i<numElements;i++) out[i]=view.getUint8(byteOffset+i); break;
        case MI.INT16:  for (let i=0;i<numElements;i++) out[i]=view.getInt16(byteOffset+2*i,le); break;
        case MI.UINT16: for (let i=0;i<numElements;i++) out[i]=view.getUint16(byteOffset+2*i,le); break;
        case MI.INT32:  for (let i=0;i<numElements;i++) out[i]=view.getInt32(byteOffset+4*i,le); break;
        case MI.UINT32: for (let i=0;i<numElements;i++) out[i]=view.getUint32(byteOffset+4*i,le); break;
        case MI.SINGLE: for (let i=0;i<numElements;i++) out[i]=view.getFloat32(byteOffset+4*i,le); break;
        case MI.DOUBLE: for (let i=0;i<numElements;i++) out[i]=view.getFloat64(byteOffset+8*i,le); break;
        case MI.INT64:  for (let i=0;i<numElements;i++) out[i]=Number(view.getBigInt64(byteOffset+8*i,le)); break;
        case MI.UINT64: for (let i=0;i<numElements;i++) out[i]=Number(view.getBigUint64(byteOffset+8*i,le)); break;
        default: break;
    }
    return out;
}

function parseElementTag(view, offset, le) {
    const word0 = view.getUint32(offset, le);
    const lo16  = word0 & 0x0000FFFF;
    const hi16  = (word0 >>> 16) & 0x0000FFFF;

    if (hi16 !== 0) {
        return { typeId: lo16, numBytes: hi16, dataStart: offset + 4, elementEnd: offset + 8 };
    }

    const typeId    = word0;
    const numBytes  = view.getUint32(offset + 4, le);
    const dataStart = offset + 8;
    const padded    = numBytes + (8 - numBytes % 8) % 8;
    return { typeId, numBytes, dataStart, elementEnd: dataStart + padded };
}

function parseMatrix(view, dataStart, numBytes, le) {
    let pos = dataStart;
    const end = dataStart + numBytes;

    const flagsTag = parseElementTag(view, pos, le);
    pos = flagsTag.elementEnd;
    const flags   = view.getUint32(flagsTag.dataStart, le);
    const mxClass = flags & 0xFF;

    const dimsTag  = parseElementTag(view, pos, le);
    pos = dimsTag.elementEnd;
    const nDims    = dimsTag.numBytes / 4;
    const dims     = [];
    for (let d = 0; d < nDims; d++) {
        dims.push(view.getInt32(dimsTag.dataStart + 4*d, le));
    }

    const nameTag = parseElementTag(view, pos, le);
    pos = nameTag.elementEnd;
    const nameBytes = new Uint8Array(view.buffer, nameTag.dataStart, nameTag.numBytes);
    const name = new TextDecoder('utf-8').decode(nameBytes).replace(/\0/g, '').trim();

    if (pos >= end) return { name, dims, data: new Float64Array(0), mxClass };
    const realTag    = parseElementTag(view, pos, le);
    const totalElems = dims.reduce((a, b) => a * b, 1);
    const data       = readElements(view, realTag.typeId, realTag.dataStart, totalElems, le);

    return { name, dims, data, mxClass };
}

// ─── Legacy Level-5 MAT Parser ───────────────────────────────────────────────

function parseLegacyMAT(buffer) {
    const view      = new DataView(buffer);
    const le        = isLittleEndian(view);
    const variables = new Map();

    let offset  = 128;
    let iters   = 0;
    const MAX   = 100000;

    while (offset < buffer.byteLength - 8 && iters++ < MAX) {
        let tag;
        try {
            tag = parseElementTag(view, offset, le);
        } catch (e) {
            break;
        }

        if (tag.elementEnd <= offset) break;

        if (tag.typeId === MI.MATRIX) {
            try {
                const v = parseMatrix(view, tag.dataStart, tag.numBytes, le);
                if (v.name && MX_NUMERIC_CLASSES.has(v.mxClass)) {
                    variables.set(v.name, v);
                }
            } catch (e) { }
        }

        offset = tag.elementEnd;
    }

    return variables;
}

// ─── MATLAB v7.3 (HDF5) Parser ───────────────────────────────────────────────

async function parseMATv73(buffer) {
    if (typeof h5wasm === 'undefined') {
        throw new Error(
            'MATLAB v7.3 (HDF5) file detected.\n' +
            'The h5wasm library is required to read this format.'
        );
    }

    await h5wasm.ready;
    const { FS } = h5wasm;

    const filename = `_mcsa_${Date.now()}.mat`;
    FS.writeFile(filename, new Uint8Array(buffer));
    const variables = new Map();

    try {
        const f = new h5wasm.File(filename, 'r');
        function traverse(group, prefix) {
            try {
                const keys = group.keys ? group.keys() : [];
                for (const key of keys) {
                    const fullKey = prefix ? `${prefix}.${key}` : key;
                    let item;
                    try { item = group.get(key); } catch(e) { continue; }
                    if (!item) continue;

                    const typeName = item.constructor ? item.constructor.name : '';
                    if (typeName === 'Dataset') {
                        try {
                            let val = item.value;
                            if (val && typeof val === 'object' && val.flat) val = val.flat(Infinity);
                            if (val && val.length > 0) {
                                const data = new Float64Array(val.length);
                                for (let i = 0; i < val.length; i++) data[i] = Number(val[i]);
                                const dims = item.shape || [data.length];
                                variables.set(fullKey, { name: key, dims, data });
                            }
                        } catch(e) { }
                    } else if (typeName === 'Group') {
                        traverse(item, fullKey);
                    }
                }
            } catch(e) { }
        }
        traverse(f, '');
        f.close();
    } finally {
        try { FS.unlink(filename); } catch(e) {}
    }

    return variables;
}

// ─── Universal Matrix Column Slicer ──────────────────────────────────────────

function extractMatrixColumn(matrixData, dims, colIndex) {
    if (!dims || dims.length !== 2) {
        return new Float32Array(matrixData);
    }

    const [d0, d1] = dims;

    // Standard column-major [N, cols]
    if (colIndex < d1 && d0 > d1) {
        const N = d0;
        const out = new Float32Array(N);
        const offset = colIndex * N;
        for (let i = 0; i < N; i++) out[i] = matrixData[offset + i];
        return out;
    }
    // Row-major or [cols, N]
    else if (colIndex < d0 && d1 > d0) {
        const N = d1;
        const out = new Float32Array(N);
        for (let i = 0; i < N; i++) out[i] = matrixData[colIndex + i * d0];
        return out;
    }

    return new Float32Array(matrixData);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Universally parse ANY MATLAB .mat file and extract the user's selected channel.
 */
async function parseMATFile(buffer, channelName) {
    const version = detectMATVersion(buffer);
    let variables;

    if (version === 'v73') {
        variables = await parseMATv73(buffer);
    } else {
        variables = parseLegacyMAT(buffer);
    }

    const rawVarNames = Array.from(variables.keys());
    if (rawVarNames.length === 0) {
        throw new Error('No numeric variables found in this MATLAB file.');
    }

    const availableChannels = [];
    let defaultChannel = null;

    for (const [name, vObj] of variables.entries()) {
        const dims = vObj.dims || [vObj.data.length];

        if (dims.length === 2 && dims[0] > 1 && dims[1] > 1) {
            const [r, c] = dims;
            const numCols = Math.min(r, c);

            if (numCols === 9) {
                for (let idx = 0; idx < 9; idx++) {
                    const colName = EXPECTED_COLUMNS_9[idx];
                    availableChannels.push({
                        id: colName,
                        label: `${colName} (${name} col ${idx+1})`,
                        varName: name,
                        colIndex: idx
                    });
                }
                if (!defaultChannel) defaultChannel = 'I1';
            } else if (numCols === 3) {
                for (let idx = 0; idx < 3; idx++) {
                    const colName = EXPECTED_COLUMNS_3[idx];
                    availableChannels.push({
                        id: colName,
                        label: `${colName} (${name} col ${idx+1})`,
                        varName: name,
                        colIndex: idx
                    });
                }
                if (!defaultChannel) defaultChannel = 'I1';
            } else if (numCols <= 64) {
                for (let idx = 0; idx < numCols; idx++) {
                    const colName = `Col_${idx+1}`;
                    availableChannels.push({
                        id: colName,
                        label: `${name} [Col ${idx+1}]`,
                        varName: name,
                        colIndex: idx
                    });
                }
                if (!defaultChannel) defaultChannel = 'Col_1';
            }
        } else {
            // 1D vector variable
            availableChannels.push({
                id: name,
                label: name,
                varName: name,
                colIndex: 0
            });
            const nLower = name.toLowerCase();
            if (!defaultChannel && CURRENT_KEYWORDS.some(k => nLower.includes(k))) {
                defaultChannel = name;
            }
        }
    }

    if (availableChannels.length === 0) {
        throw new Error('Could not find extractable numeric channels in the file.');
    }
    if (!defaultChannel) {
        defaultChannel = availableChannels[0].id;
    }

    const requested = (channelName || defaultChannel).toLowerCase().trim();
    let targetEntry = availableChannels.find(ch => ch.id.toLowerCase() === requested) ||
                      availableChannels.find(ch => ch.id.toLowerCase().includes(requested)) ||
                      availableChannels[0];

    const parentVar = variables.get(targetEntry.varName);
    let signal;

    if (parentVar.dims && parentVar.dims.length === 2 && Math.min(parentVar.dims[0], parentVar.dims[1]) > 1) {
        signal = extractMatrixColumn(parentVar.data, parentVar.dims, targetEntry.colIndex);
    } else {
        signal = new Float32Array(parentVar.data);
    }

    const varLabels = availableChannels.map(ch => ch.id);

    return {
        signal,
        varNames: varLabels,
        version,
        extractedChannel: targetEntry.id
    };
}

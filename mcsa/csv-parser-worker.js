'use strict';
/**
 * csv-parser-worker.js — Universal Chunked CSV Parser (Web Worker context)
 *
 * Supports ANY arbitrary CSV / tabular recording:
 *   • Auto-detects delimiter: comma (,), semicolon (;), tab (\t), or whitespace
 *   • Auto-detects header presence or numeric first row
 *   • Handles 1-column files (single stator current channel)
 *   • Handles 2-column files (e.g. Time + Current), auto-calculating sampling frequency Fs
 *   • Handles N-column files with dynamic channel discovery
 *   • Auto-selects stator current channels (matching current, curr, ia, i1, stator, etc.)
 *   • Low-memory chunked streaming (4 MB chunks) without buffering full file as a string
 */

const CSV_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB per decode pass

// Keywords indicating a stator current channel
var CURRENT_KEYWORDS = [
    'i1', 'ia', 'current', 'curr', 'stator', 'phase a', 'phase_a', 'phasea',
    'i_1', 'i_a', 'i2', 'ib', 'phase b', 'i3', 'ic', 'phase c', 'amp'
];

// Keywords indicating a time column
const TIME_KEYWORDS = ['time', 't', 'timestamp', 'sec', 'seconds', 'ms', 'time_s'];

// Standard 9-channel benchmark column names
var EXPECTED_COLUMNS_9 = ['x', 'y', 'Z', 'I1', 'I2', 'I3', 'V1', 'V2', 'V3'];

// ─── Delimiter & Header Detection ─────────────────────────────────────────────

function detectDelimiter(firstLine) {
    const counts = {
        ',': (firstLine.match(/,/g) || []).length,
        ';': (firstLine.match(/;/g) || []).length,
        '\t': (firstLine.match(/\t/g) || []).length
    };
    let best = ',';
    let max = 0;
    for (const [delim, count] of Object.entries(counts)) {
        if (count > max) {
            max = count;
            best = delim;
        }
    }
    if (max === 0 && /\s{2,}/.test(firstLine.trim())) {
        return /\s+/;
    }
    return best;
}

function splitLine(line, delimiter) {
    if (delimiter instanceof RegExp) {
        return line.trim().split(delimiter);
    }
    return line.split(delimiter);
}

function lineIsHeader(tokens) {
    if (!tokens || tokens.length === 0) return false;
    let alphaCount = 0;
    for (const tok of tokens) {
        const cleaned = tok.replace(/['"\s]/g, '');
        if (/[a-zA-Z_]/.test(cleaned) && !isFinite(parseFloat(cleaned))) {
            alphaCount++;
        }
    }
    return alphaCount > 0;
}

// ─── Universal Column Index Finder ────────────────────────────────────────────

function determineCSVColumns(firstLine, requestedChannel) {
    const delim = detectDelimiter(firstLine);
    const rawTokens = splitLine(firstLine, delim).map(t => t.trim().replace(/['"]/g, ''));
    const numCols = rawTokens.length;

    let headers = null;
    let availableChannels = [];
    let selectedColIndex = 0;
    let timeColIndex = -1;

    const hasHeader = lineIsHeader(rawTokens);

    if (hasHeader) {
        headers = rawTokens;
        for (let i = 0; i < headers.length; i++) {
            const h = headers[i] || ('Col_' + (i + 1));
            availableChannels.push({ id: h, label: h, index: i });
            const hLower = h.toLowerCase();
            if (timeColIndex === -1 && TIME_KEYWORDS.some(k => hLower === k || hLower.startsWith(k))) {
                timeColIndex = i;
            }
        }
    } else {
        headers = null;
        if (numCols === 9) {
            for (let i = 0; i < 9; i++) {
                availableChannels.push({ id: EXPECTED_COLUMNS_9[i], label: EXPECTED_COLUMNS_9[i], index: i });
            }
        } else if (numCols === 3) {
            availableChannels = [
                { id: 'I1', label: 'I1 (Phase 1)', index: 0 },
                { id: 'I2', label: 'I2 (Phase 2)', index: 1 },
                { id: 'I3', label: 'I3 (Phase 3)', index: 2 }
            ];
        } else if (numCols === 1) {
            availableChannels = [{ id: 'Current', label: 'Stator Current (Col 1)', index: 0 }];
        } else {
            for (let i = 0; i < numCols; i++) {
                availableChannels.push({ id: 'Col_' + (i + 1), label: 'Column ' + (i + 1), index: i });
            }
        }
    }

    let bestMatchIndex = -1;

    if (requestedChannel) {
        const req = requestedChannel.toLowerCase().trim();
        const found = availableChannels.find(ch => ch.id.toLowerCase() === req || ch.id.toLowerCase().endsWith(req));
        if (found) bestMatchIndex = found.index;
    }

    if (bestMatchIndex === -1) {
        for (const kw of CURRENT_KEYWORDS) {
            const found = availableChannels.find(ch => {
                const id = ch.id.toLowerCase();
                return id === kw || id.includes(kw);
            });
            if (found) {
                bestMatchIndex = found.index;
                break;
            }
        }
    }

    if (bestMatchIndex === -1 && numCols === 9 && !hasHeader) {
        bestMatchIndex = 3; // Standard 9-channel col 3 = I1
    }

    if (bestMatchIndex === -1 && numCols === 2 && timeColIndex === 0) {
        bestMatchIndex = 1; // Col 0 is time, col 1 is current
    }

    if (bestMatchIndex === -1) {
        const nonTime = availableChannels.find(ch => ch.index !== timeColIndex);
        bestMatchIndex = nonTime ? nonTime.index : 0;
    }

    selectedColIndex = bestMatchIndex;

    return {
        delimiter: delim,
        hasHeader,
        headers,
        availableChannels,
        selectedColIndex,
        timeColIndex,
        selectedChannelName: (availableChannels.find(ch => ch.index === selectedColIndex) || {}).id || ('Col_' + (selectedColIndex + 1))
    };
}

// ─── Main Streaming Parser ───────────────────────────────────────────────────

function parseCSVBuffer(buffer, channelName, onProgress) {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const totalBytes = buffer.byteLength;

    let delimiter = ',';
    let headers = null;
    let columnIndex = 0;
    let timeColIndex = -1;
    let headerChecked = false;
    let remainder = '';
    let availableChannels = [];
    let detectedFs = null;

    const timeSamples = [];

    let capacity = Math.max(1024 * 1024, Math.ceil(totalBytes / 80));
    let samples = new Float32Array(capacity);
    let count = 0;

    function ensureCapacity() {
        if (count >= samples.length) {
            const next = new Float32Array(samples.length * 2);
            next.set(samples);
            samples = next;
        }
    }

    function processLine(line) {
        const trimmed = line.trim();
        if (!trimmed) return;

        if (!headerChecked) {
            headerChecked = true;
            const meta = determineCSVColumns(trimmed, channelName);
            delimiter = meta.delimiter;
            headers = meta.headers;
            columnIndex = meta.selectedColIndex;
            timeColIndex = meta.timeColIndex;
            availableChannels = meta.availableChannels;

            if (meta.hasHeader) return;
        }

        const tokens = splitLine(trimmed, delimiter);
        if (columnIndex < tokens.length) {
            const val = parseFloat(tokens[columnIndex].trim());
            if (isFinite(val)) {
                ensureCapacity();
                samples[count++] = val;
            }
        }

        if (timeColIndex >= 0 && timeColIndex < tokens.length && timeSamples.length < 200) {
            const tVal = parseFloat(tokens[timeColIndex].trim());
            if (isFinite(tVal)) timeSamples.push(tVal);
        }
    }

    for (let offset = 0; offset < totalBytes; offset += CSV_CHUNK_SIZE) {
        const isLast = offset + CSV_CHUNK_SIZE >= totalBytes;
        const end = Math.min(offset + CSV_CHUNK_SIZE, totalBytes);
        const chunk = buffer.slice(offset, end);
        const text = remainder + decoder.decode(chunk, { stream: !isLast });

        const newlinePos = text.lastIndexOf('\n');
        let completeSection, newRemainder;
        if (isLast || newlinePos === -1) {
            completeSection = text;
            newRemainder = '';
        } else {
            completeSection = text.slice(0, newlinePos);
            newRemainder = text.slice(newlinePos + 1);
        }
        remainder = newRemainder;

        let lineStart = 0;
        for (let ci = 0; ci < completeSection.length; ci++) {
            if (completeSection[ci] === '\n') {
                processLine(completeSection.slice(lineStart, ci));
                lineStart = ci + 1;
            }
        }
        if (lineStart < completeSection.length) {
            processLine(completeSection.slice(lineStart));
        }

        if (onProgress) {
            onProgress(Math.round((end / totalBytes) * 100), 'Parsing CSV');
        }
    }

    if (remainder.trim()) processLine(remainder);

    if (count === 0) {
        throw new Error('No valid numeric data could be extracted from this CSV file.');
    }

    if (timeSamples.length >= 10) {
        const diffs = [];
        for (let i = 1; i < timeSamples.length; i++) {
            const dt = timeSamples[i] - timeSamples[i - 1];
            if (dt > 1e-9) diffs.push(dt);
        }
        if (diffs.length > 5) {
            diffs.sort((a, b) => a - b);
            const medianDt = diffs[Math.floor(diffs.length / 2)];
            if (medianDt > 0) {
                detectedFs = Math.round(1.0 / medianDt);
            }
        }
    }

    const channelNames = availableChannels.map(ch => ch.id);
    const selectedChannel = (availableChannels.find(ch => ch.index === columnIndex) || {}).id || ('Col_' + (columnIndex + 1));

    return {
        signal: samples.slice(0, count),
        headers: channelNames,
        columnIndex,
        selectedChannel,
        detectedFs,
        sampleCount: count
    };
}

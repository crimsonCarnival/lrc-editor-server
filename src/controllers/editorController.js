import {
  applyMark,
  applyBulkShift,
  applyGlobalOffset,
  clearAllTimestamps,
  clearLineTimestamp,
  detectDuplicateTimestamps,
} from '../services/editorService.js';

/**
 * POST /editor/mark — apply a timestamp mark.
 */
export async function mark(req, res) {
  const {
    lines,
    activeLineIndex,
    time,
    editorMode,
    activeWordIndex = 0,
    stampTarget = 'main',
    awaitingEndMark = null,
    focusedTimestamp = null,
    settings,
  } = req.body;

  const result = applyMark({
    lines,
    activeLineIndex,
    time,
    editorMode,
    activeWordIndex,
    stampTarget,
    awaitingEndMark,
    focusedTimestamp,
    settings,
  });

  return res.send(result);
}

/**
 * POST /editor/bulk-shift — shift timestamps for selected lines.
 */
export async function bulkShift(req, res) {
  const { lines, selectedIndices, delta } = req.body;
  const result = applyBulkShift(lines, selectedIndices, delta);
  return res.send({ lines: result });
}

/**
 * POST /editor/global-offset — apply global offset to all lines.
 */
export async function globalOffset(req, res) {
  const { lines, delta } = req.body;
  const result = applyGlobalOffset(lines, delta);
  return res.send({ lines: result });
}

/**
 * POST /editor/clear-all — clear all timestamps.
 */
export async function clearAll(req, res) {
  const { lines, isSrt = false, isWords = false } = req.body;
  const result = clearAllTimestamps(lines, isSrt, isWords);
  return res.send({ lines: result });
}

/**
 * POST /editor/clear-line — clear a single line's timestamps.
 */
export async function clearLine(req, res) {
  const { lines, index, isSrt = false, isWords = false } = req.body;
  const result = clearLineTimestamp(lines, index, isSrt, isWords);
  return res.send({ lines: result });
}

/**
 * POST /editor/detect-duplicates — find overlapping timestamps.
 */
export async function detectDuplicates(req, res) {
  const { lines, threshold = 0.05 } = req.body;
  const indices = detectDuplicateTimestamps(lines, threshold);
  return res.send({ overlappingIndices: indices });
}

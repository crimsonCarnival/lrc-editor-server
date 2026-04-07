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
export async function mark(request, reply) {
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
  } = request.body;

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

  return reply.send(result);
}

/**
 * POST /editor/bulk-shift — shift timestamps for selected lines.
 */
export async function bulkShift(request, reply) {
  const { lines, selectedIndices, delta } = request.body;
  const result = applyBulkShift(lines, selectedIndices, delta);
  return reply.send({ lines: result });
}

/**
 * POST /editor/global-offset — apply global offset to all lines.
 */
export async function globalOffset(request, reply) {
  const { lines, delta } = request.body;
  const result = applyGlobalOffset(lines, delta);
  return reply.send({ lines: result });
}

/**
 * POST /editor/clear-all — clear all timestamps.
 */
export async function clearAll(request, reply) {
  const { lines, isSrt = false, isWords = false } = request.body;
  const result = clearAllTimestamps(lines, isSrt, isWords);
  return reply.send({ lines: result });
}

/**
 * POST /editor/clear-line — clear a single line's timestamps.
 */
export async function clearLine(request, reply) {
  const { lines, index, isSrt = false, isWords = false } = request.body;
  const result = clearLineTimestamp(lines, index, isSrt, isWords);
  return reply.send({ lines: result });
}

/**
 * POST /editor/detect-duplicates — find overlapping timestamps.
 */
export async function detectDuplicates(request, reply) {
  const { lines, threshold = 0.05 } = request.body;
  const indices = detectDuplicateTimestamps(lines, threshold);
  return reply.send({ overlappingIndices: indices });
}

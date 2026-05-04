/**
 * Lyrics module — merged controller for /lyrics (parse/compile) and /editor (mark/shift/clear).
 * These were separate controllers but operate on the same domain (structured lyric lines).
 */

import {
  parseLrcSrtFile,
  compileLRC,
  compileSRT,
  inferEndTimes,
} from '../../utils/lrc.js';

import {
  applyMark,
  applyBulkShift,
  applyGlobalOffset,
  clearAllTimestamps,
  clearLineTimestamp,
  detectDuplicateTimestamps,
} from './lyrics.service.js';

// ─── Parse / Compile ───────────────────────────────────────────────

/**
 * POST /lyrics/parse — parse raw LRC/SRT content into structured lines.
 */
export async function parse(req, res) {
  const { content, filename } = req.body;

  if (!content || typeof content !== 'string') {
    return res.code(400).send({ error: 'Lyrics content is required' });
  }

  if (content.length > 5 * 1024 * 1024) {
    return res.code(413).send({ error: 'Lyrics content too large (max 5MB)' });
  }

  const normalizedName = (filename || 'lyrics.lrc').toLowerCase();
  if (!normalizedName.endsWith('.lrc') && !normalizedName.endsWith('.srt') && !normalizedName.endsWith('.txt')) {
    return res.code(400).send({ error: 'Unsupported lyrics format' });
  }

  const lines = parseLrcSrtFile(content, filename);
  return res.send({
    lines,
    detectedFormat: filename.toLowerCase().endsWith('.srt') ? 'srt' : 'lrc',
    count: lines.length,
  });
}

/**
 * POST /lyrics/compile/lrc — compile structured lines into LRC format.
 */
export async function compileLrc(req, res) {
  const {
    lines,
    includeTranslations = false,
    precision = 'hundredths',
    metadata = {},
    lineEndings = 'lf',
    includeSecondary = false,
    wordPrecision,
  } = req.body;

  const output = compileLRC(lines, includeTranslations, precision, metadata, lineEndings, includeSecondary, wordPrecision);
  return res.send({ output, format: 'lrc' });
}

/**
 * POST /lyrics/compile/srt — compile structured lines into SRT format.
 */
export async function compileSrt(req, res) {
  const {
    lines,
    duration = null,
    includeTranslations = false,
    lineEndings = 'lf',
    srtConfig = {},
    includeSecondary = false,
  } = req.body;

  const output = compileSRT(lines, duration, includeTranslations, lineEndings, srtConfig, includeSecondary);
  return res.send({ output, format: 'srt' });
}

/**
 * POST /lyrics/infer-end-times — infer missing end times for SRT mode.
 */
export async function inferEnd(req, res) {
  const { lines, duration = null, srtConfig = {} } = req.body;
  const result = inferEndTimes(lines, duration, srtConfig);
  return res.send({ lines: result });
}

// ─── Editor operations ─────────────────────────────────────────────

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
    lines, activeLineIndex, time, editorMode,
    activeWordIndex, stampTarget, awaitingEndMark, focusedTimestamp, settings,
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

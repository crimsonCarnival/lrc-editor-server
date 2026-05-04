import {
  parseLrcSrtFile,
  compileLRC,
  compileSRT,
  inferEndTimes,
} from '../utils/lrc.js';

/**
 * POST /lyrics/parse — parse raw LRC/SRT content into structured lines.
 */
export async function parse(req, res) {
  const { content, filename } = req.body;
  
  if (!content || typeof content !== 'string') {
    return res.code(400).send({ error: 'Lyrics content is required' });
  }

  // Max 5MB check (matching frontend)
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

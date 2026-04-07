import {
  parseLrcSrtFile,
  compileLRC,
  compileSRT,
  inferEndTimes,
} from '../utils/lrc.js';

/**
 * POST /lyrics/parse — parse raw LRC/SRT content into structured lines.
 */
export async function parse(request, reply) {
  const { content, filename } = request.body;
  const lines = parseLrcSrtFile(content, filename);

  return reply.send({
    lines,
    detectedFormat: filename.toLowerCase().endsWith('.srt') ? 'srt' : 'lrc',
    count: lines.length,
  });
}

/**
 * POST /lyrics/compile/lrc — compile structured lines into LRC format.
 */
export async function compileLrc(request, reply) {
  const {
    lines,
    includeTranslations = false,
    precision = 'hundredths',
    metadata = {},
    lineEndings = 'lf',
    includeSecondary = false,
  } = request.body;

  const output = compileLRC(lines, includeTranslations, precision, metadata, lineEndings, includeSecondary);
  return reply.send({ output, format: 'lrc' });
}

/**
 * POST /lyrics/compile/srt — compile structured lines into SRT format.
 */
export async function compileSrt(request, reply) {
  const {
    lines,
    duration = null,
    includeTranslations = false,
    lineEndings = 'lf',
    srtConfig = {},
    includeSecondary = false,
  } = request.body;

  const output = compileSRT(lines, duration, includeTranslations, lineEndings, srtConfig, includeSecondary);
  return reply.send({ output, format: 'srt' });
}

/**
 * POST /lyrics/infer-end-times — infer missing end times for SRT mode.
 */
export async function inferEnd(request, reply) {
  const { lines, duration = null, srtConfig = {} } = request.body;
  const result = inferEndTimes(lines, duration, srtConfig);
  return reply.send({ lines: result });
}

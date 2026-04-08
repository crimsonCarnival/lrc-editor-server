/**
 * LRC / SRT utilities — format timestamps, compile, parse.
 * Server-side port of client/src/utils/lrc.js (no browser APIs).
 */

import crypto from 'node:crypto';
import { serializeToRubyMarkup, parseRubyMarkup } from './furigana.js';

// ——— Internal helpers ———

function buildSecondaryText(line, wordPrecision) {
  if (line.secondaryWords?.length && line.secondaryWords.some(w => w.time != null)) {
    return formatWordsToLrc(line.secondaryWords, wordPrecision);
  }
  if (line.words?.some(w => w.reading)) {
    return serializeToRubyMarkup(line.words);
  }
  return line.secondary || null;
}

function formatWordsToLrc(words, precision = 'hundredths') {
  const cjk = (ch) => {
    const c = ch?.codePointAt(0) ?? 0;
    return (c >= 0x3000 && c <= 0x9FFF) || (c >= 0xF900 && c <= 0xFAFF) ||
      (c >= 0xFF00 && c <= 0xFFEF) || (c >= 0x20000 && c <= 0x2FA1F);
  };
  return words.map((w, i, arr) => {
    const token = `${formatWordTimestamp(w.time, precision)}${w.word}`;
    const next = arr[i + 1];
    if (!next) return token;
    const lastChar = w.word.slice(-1);
    const firstChar = next.word.slice(0, 1);
    return cjk(lastChar) || cjk(firstChar) ? token : token + ' ';
  }).join('');
}

function formatWordTimestamp(seconds, precision = 'hundredths') {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const mm = String(mins).padStart(2, '0');
  const decimals = precision === 'thousandths' ? 3 : 2;
  const padLen = decimals + 3;
  const ss = secs.toFixed(decimals).padStart(padLen, '0');
  return `<${mm}:${ss}>`;
}

function sanitizeLrcTag(s) {
  return s.replace(/[[\]]/g, '');
}

// ——— Exported functions ———

/**
 * Format seconds into LRC timestamp [mm:ss.xx] or [mm:ss.xxx]
 */
export function formatTimestamp(seconds, precision = 'hundredths') {
  if (seconds == null || isNaN(seconds) || seconds < 0) {
    return precision === 'thousandths' ? '00:00.000' : '00:00.00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const mm = String(mins).padStart(2, '0');
  const decimals = precision === 'thousandths' ? 3 : 2;
  const padLen = decimals + 3;
  const ss = secs.toFixed(decimals).padStart(padLen, '0');
  return `${mm}:${ss}`;
}

/**
 * Parse LRC timestamp string like "[01:23.45]" into seconds
 */
export function parseTimestamp(str) {
  const match = str.match(/\[(\d{2}):(\d{2}\.\d{2,3})\]/);
  if (!match) return null;
  return parseInt(match[1], 10) * 60 + parseFloat(match[2]);
}

/**
 * Format seconds into SRT timestamp HH:MM:SS,mmm
 */
export function formatSrtTimestamp(seconds) {
  if (seconds == null || isNaN(seconds) || seconds < 0) return '00:00:00,000';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Parse inline word-level timestamp tokens from LRC line text.
 */
export function parseWordTimestamps(text) {
  const re = /<(\d{1,2}):(\d{2}\.\d{2,3})>([^<]*)/g;
  const words = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    const time = parseInt(match[1], 10) * 60 + parseFloat(match[2]);
    const word = match[3].trimEnd();
    if (word) words.push({ word, time });
  }
  const hasCJK = words.some(w => /[\u3000-\u9FFF\uF900-\uFAFF]/.test(w.word));
  if (hasCJK && words.length > 0) {
    const expanded = [];
    const isCJKChar = (ch) => /[\u3000-\u9FFF\uF900-\uFAFF]/.test(ch);
    words.forEach((w, wi) => {
      const codePoints = [...w.word].filter(ch => ch.trim());
      if (!codePoints.some(isCJKChar)) { expanded.push(w); return; }
      if (codePoints.length <= 1) { expanded.push(w); return; }
      const nextTime = words[wi + 1]?.time;
      const duration = nextTime != null ? nextTime - w.time : null;
      const subTokens = [];
      let ci = 0;
      while (ci < codePoints.length) {
        const ch = codePoints[ci];
        if (isCJKChar(ch)) {
          subTokens.push(ch);
          ci++;
        } else {
          let j = ci;
          while (j < codePoints.length && !isCJKChar(codePoints[j])) j++;
          subTokens.push(codePoints.slice(ci, j).join(''));
          ci = j;
        }
      }
      subTokens.forEach((token, si) => {
        const t = duration != null
          ? w.time + (duration * si / subTokens.length)
          : w.time + si * 0.1;
        expanded.push({ word: token, time: parseFloat(t.toFixed(3)) });
      });
    });
    return expanded;
  }
  return words;
}

/**
 * Compile lines into a valid .lrc string.
 */
export function compileLRC(lines, includeTranslations = false, precision = 'hundredths', metadata = {}, lineEndings = 'lf', includeSecondary = false, wordPrecision) {
  const wp = wordPrecision || precision;
  let header = '';
  if (metadata.ti) header += `[ti:${sanitizeLrcTag(metadata.ti)}]\n`;
  if (metadata.ar) header += `[ar:${sanitizeLrcTag(metadata.ar)}]\n`;
  if (metadata.al) header += `[al:${sanitizeLrcTag(metadata.al)}]\n`;
  if (metadata.lg) header += `[lg:${sanitizeLrcTag(metadata.lg)}]\n`;

  const body = lines
    .flatMap((line) => {
      if (line.timestamp != null) {
        const ts = line.timestamp;
        const wordText = line.words?.length
          ? formatWordsToLrc(line.words, wp)
          : line.text;
        let out = `[${formatTimestamp(ts, precision)}] ${wordText}`;
        if (includeSecondary) {
          const sec = buildSecondaryText(line, wp);
          if (sec) out += `\n[${formatTimestamp(ts, precision)}] ${sec}`;
        }
        if (includeTranslations && line.translation) {
          out += `\n[${formatTimestamp(ts, precision)}] ${line.translation}`;
        }
        return out;
      }
      return [line.text];
    })
    .join('\n');

  let result = header + body;
  return lineEndings === 'crlf' ? result.replace(/\n/g, '\r\n') : result;
}

/**
 * Compile lines into a valid .srt string.
 */
export function compileSRT(lines, duration, includeTranslations = false, lineEndings = 'lf', srtConfig = {}, includeSecondary = false) {
  const minGap = srtConfig.minSubtitleGap || 0.05;
  const defaultDur = srtConfig.defaultSubtitleDuration || 5;

  const synced = lines.filter((l) => l.timestamp != null);
  if (synced.length === 0) return '';

  const body = synced.map((line, i) => {
    const start = line.timestamp;
    let end;
    if (line.endTime != null) {
      end = line.endTime;
    } else {
      const nextLine = synced[i + 1];
      if (nextLine && nextLine.timestamp != null) {
        end = Math.max(start + minGap, nextLine.timestamp - minGap);
      } else if (duration) {
        end = Math.min(start + defaultDur, duration);
      } else {
        end = start + defaultDur;
      }
    }

    return `${i + 1}\n${formatSrtTimestamp(start)} --> ${formatSrtTimestamp(end)}\n${
      (includeSecondary && buildSecondaryText(line)) ? buildSecondaryText(line) + '\n' : ''
    }${line.text}${
      (includeTranslations && line.translation) ? '\n' + line.translation : ''
    }\n`;
  }).join('\n');

  return lineEndings === 'crlf' ? body.replace(/\n/g, '\r\n') : body;
}

/**
 * Parse an LRC or SRT file into an array of line objects.
 * Uses crypto.randomUUID() (Node built-in) instead of the browser API.
 */
export function parseLrcSrtFile(content, filename) {
  const isSrt = filename.toLowerCase().endsWith('.srt');
  const parsedLines = [];

  if (isSrt) {
    const blocks = content.replace(/\r\n/g, '\n').split('\n\n');
    blocks.forEach(block => {
      const parts = block.trim().split('\n');
      if (parts.length >= 3) {
        const timeMatch = parts[1].match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
        if (timeMatch) {
          const timestamp = parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 +
            parseInt(timeMatch[3], 10) + parseInt(timeMatch[4], 10) / 1000;
          const endTime = parseInt(timeMatch[5], 10) * 3600 + parseInt(timeMatch[6], 10) * 60 +
            parseInt(timeMatch[7], 10) + parseInt(timeMatch[8], 10) / 1000;
          const text = parts.slice(2).join('\n');
          parsedLines.push({ text, timestamp, endTime, secondary: '', translation: '', id: crypto.randomUUID() });
        }
      }
    });
  } else {
    const lrcLines = content.replace(/\r\n/g, '\n').split('\n');
    lrcLines.forEach(line => {
      let remaining = line.trim();
      const tsStepRe = /^\[(\d{1,2}):(\d{2}\.\d{2,3})\]/;
      const collectedTs = [];
      let step;
      while ((step = remaining.match(tsStepRe))) {
        collectedTs.push(parseInt(step[1], 10) * 60 + parseFloat(step[2]));
        remaining = remaining.slice(step[0].length);
      }
      if (collectedTs.length > 0) {
        const rawText = remaining.trim();
        const words = parseWordTimestamps(rawText);
        const text = rawText.replace(/<\d{1,2}:\d{2}\.\d{2,3}>/g, '').trim();
        collectedTs.sort((a, b) => a - b);
        const [primary] = collectedTs;
        const entry = { text, timestamp: primary, id: crypto.randomUUID() };
        if (words.length > 0) entry.words = words;
        parsedLines.push(entry);
      } else if (remaining !== '' && !/^\[[^\]]*:[^\]]*\]/.test(remaining)) {
        parsedLines.push({ text: remaining.trim(), timestamp: null, id: crypto.randomUUID() });
      }
    });
  }

  // Merge duplicate timestamps (bilingual LRC)
  const mergedLines = [];
  const timestampMap = new Map();

  for (const line of parsedLines) {
    if (line.timestamp == null) {
      mergedLines.push(line);
      continue;
    }
    const key = Math.round(line.timestamp * 100);
    if (timestampMap.has(key)) {
      const existingIndex = timestampMap.get(key);
      const existing = mergedLines[existingIndex];
      if (!existing.secondary && !existing.translation) {
        const secWords = parseWordTimestamps(line.text);
        if (secWords.length > 0) {
          existing.secondaryWords = secWords;
          existing.secondary = line.text.replace(/<\d{1,2}:\d{2}\.\d{2,3}>/g, '').trim();
        } else if (/\{[^|{]+\|[^}]+\}/.test(line.text)) {
          const { plainText, segments } = parseRubyMarkup(line.text);
          existing.secondary = plainText;
          if (existing.words?.length) {
            const readingAt = new Map();
            let pos = 0;
            for (const seg of segments) {
              if (seg.reading) readingAt.set(pos, seg.reading);
              pos += [...seg.text].length;
            }
            let c = 0;
            existing.words = existing.words.map((w) => {
              const reading = readingAt.get(c);
              c += [...w.word].length;
              return reading ? { ...w, reading } : w;
            });
          }
        } else {
          existing.secondary = line.text;
        }
      } else if (!existing.translation) {
        existing.translation = line.text;
      }
    } else {
      const idx = mergedLines.length;
      mergedLines.push({ ...line });
      timestampMap.set(key, idx);
    }
  }

  return mergedLines;
}

/**
 * Infer end times for lines that don't have them.
 */
export function inferEndTimes(lines, duration, srtConfig = {}) {
  const minGap = srtConfig.minSubtitleGap || 0.05;
  const defaultDur = srtConfig.defaultSubtitleDuration || 5;

  return lines.map((line, i) => {
    if (line.endTime != null) return line;
    if (line.timestamp == null) return line;

    let nextStart = null;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j].timestamp != null) {
        nextStart = lines[j].timestamp;
        break;
      }
    }

    let endTime;
    if (nextStart != null) {
      endTime = Math.max(line.timestamp + minGap, nextStart - minGap);
    } else if (duration) {
      endTime = Math.min(line.timestamp + defaultDur, duration);
    } else {
      endTime = line.timestamp + defaultDur;
    }

    return { ...line, endTime };
  });
}

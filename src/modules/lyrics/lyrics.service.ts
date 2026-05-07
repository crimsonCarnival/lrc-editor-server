import type { LineEntry, MarkInput, MarkResult, EditorSettings } from '../../types/index.js';

export function detectDuplicateTimestamps(lines: LineEntry[], threshold = 0.05): number[] {
  const overlapping = new Set<number>();
  const timestamped: { index: number; time: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timestamp != null) {
      timestamped.push({ index: i, time: lines[i].timestamp! });
    }
  }
  for (let a = 0; a < timestamped.length; a++) {
    for (let b = a + 1; b < timestamped.length; b++) {
      if (Math.abs(timestamped[a].time - timestamped[b].time) <= threshold) {
        overlapping.add(timestamped[a].index);
        overlapping.add(timestamped[b].index);
      }
    }
  }
  return [...overlapping];
}

export function computeNextIndex(lines: LineEntry[], fromIndex: number, skipBlank?: boolean): number {
  let nextIndex = fromIndex + 1;
  if (skipBlank) {
    while (nextIndex < lines.length) {
      const text = lines[nextIndex]?.text?.trim();
      if (text && text !== '\u266a') break;
      nextIndex++;
    }
  }
  return Math.min(nextIndex, lines.length - 1);
}

export function applyBulkShift(lines: LineEntry[], selectedIndices: unknown, delta: unknown): LineEntry[] {
  const numericDelta = Number(delta) || 0;
  const selected = new Set(selectedIndices as number[]);
  return lines.map((l, idx) => {
    if (!selected.has(idx) || l.timestamp == null) return l;
    const newTimestamp = Math.max(0, Number(l.timestamp) + numericDelta);
    if (isNaN(newTimestamp)) return l;
    const result: LineEntry = { ...l, timestamp: newTimestamp };
    if (result.endTime != null) {
      result.endTime = Math.max(0, Number(l.endTime) + numericDelta);
    }
    return result;
  });
}

export function applyGlobalOffset(lines: LineEntry[], delta: unknown): LineEntry[] {
  const numericDelta = Number(delta);
  if (isNaN(numericDelta) || numericDelta === 0) return lines;
  return lines.map((l) => ({
    ...l,
    timestamp: l.timestamp != null ? Math.max(0, l.timestamp + numericDelta) : null,
    endTime: l.endTime != null ? Math.max(0, l.endTime + numericDelta) : l.endTime,
  }));
}

export function clearAllTimestamps(lines: LineEntry[], isSrt?: boolean, isWords?: boolean): LineEntry[] {
  return lines.map((l) => ({
    ...l,
    timestamp: null,
    ...(isSrt && { endTime: null }),
    ...(isWords && l.words && { words: l.words.map((w) => ({ ...w, time: null })) }),
  }));
}

export function clearLineTimestamp(lines: LineEntry[], index: unknown, isSrt?: boolean, isWords?: boolean): LineEntry[] {
  return lines.map((l, i) =>
    i === index
      ? {
          ...l,
          timestamp: null,
          ...(isSrt && { endTime: null }),
          ...(isWords && l.words && { words: l.words.map((w) => ({ ...w, time: null })) }),
        }
      : l,
  );
}

function stampBlanks(lines: LineEntry[], fromIndex: number, time: number, isSrt: boolean): { lines: LineEntry[]; nextBlankEnd: number } {
  const updated = [...lines];
  let nextIndex = fromIndex + 1;
  while (nextIndex < updated.length) {
    const text = updated[nextIndex]?.text?.trim();
    if (text && text !== '\u266a') break;
    nextIndex++;
  }
  for (let i = fromIndex + 1; i < nextIndex; i++) {
    updated[i] = isSrt
      ? { ...updated[i], timestamp: time, endTime: time }
      : { ...updated[i], timestamp: time };
  }
  return { lines: updated, nextBlankEnd: nextIndex };
}

export function applyMark(input: MarkInput): MarkResult {
  const { lines, activeLineIndex, time, editorMode, activeWordIndex = 0, stampTarget = 'main', awaitingEndMark, focusedTimestamp, settings } = input;

  if (activeLineIndex >= lines.length) {
    return { nextLines: lines, nextActiveLineIndex: null, nextAwaitingEndMark: undefined };
  }

  const skipBlank = (settings as EditorSettings).autoAdvance?.skipBlank;
  const autoAdvance = (settings as EditorSettings).autoAdvance?.enabled;
  const isSrt = editorMode === 'srt';

  if (focusedTimestamp) {
    const updated = [...lines];
    const ft = focusedTimestamp as { lineIndex: number; type: string };
    const line = updated[ft.lineIndex];
    if (line) {
      updated[ft.lineIndex] = {
        ...line,
        ...(ft.type === 'start'
          ? { timestamp: time }
          : { endTime: Math.max(line.timestamp ?? 0, time) }),
      };
    }
    return { nextLines: updated, nextActiveLineIndex: null, nextAwaitingEndMark: undefined };
  }

  const isWords = editorMode === 'words';

  if (isWords) {
    const updated = [...lines];
    const line = updated[activeLineIndex];
    const wordField = stampTarget === 'secondary' ? 'secondaryWords' : 'words';
    const words = (line as unknown as Record<string, unknown>)[wordField] as unknown[] || [];

    if (line.timestamp == null) {
      updated[activeLineIndex] = { ...line, timestamp: time };
      if (!words.length) {
        const nextIdx = autoAdvance ? computeNextIndex(lines, activeLineIndex, skipBlank) : null;
        return { nextLines: updated, nextActiveLineIndex: nextIdx, nextAwaitingEndMark: null, nextActiveWordIndex: 0 };
      }
      return { nextLines: updated, nextActiveLineIndex: null, nextAwaitingEndMark: null, nextActiveWordIndex: 0 };
    }

    const clampedIdx = Math.min(activeWordIndex, words.length - 1);
    if (clampedIdx >= 0) {
      const newWords = [...words] as { word?: string; time?: number | null; reading?: string }[];
      newWords[clampedIdx] = { ...newWords[clampedIdx], time };
      updated[activeLineIndex] = { ...line, [wordField]: newWords };
      const nextWordIdx = clampedIdx + 1;
      if (nextWordIdx >= words.length) {
        const nextIdx = autoAdvance ? computeNextIndex(lines, activeLineIndex, skipBlank) : null;
        return { nextLines: updated, nextActiveLineIndex: nextIdx, nextAwaitingEndMark: null, nextActiveWordIndex: 0 };
      }
      return { nextLines: updated, nextActiveLineIndex: null, nextAwaitingEndMark: null, nextActiveWordIndex: nextWordIdx };
    }

    const nextIdx = autoAdvance ? computeNextIndex(lines, activeLineIndex, skipBlank) : null;
    return { nextLines: updated, nextActiveLineIndex: nextIdx, nextAwaitingEndMark: null, nextActiveWordIndex: 0 };
  }

  if (isSrt) {
    if ((settings as EditorSettings).srt?.snapToNextLine) {
      let updated = [...lines];
      let lastSyncedIndex = activeLineIndex - 1;
      while (lastSyncedIndex >= 0 && updated[lastSyncedIndex].timestamp == null) {
        lastSyncedIndex--;
      }
      if (lastSyncedIndex >= 0 && updated[lastSyncedIndex].endTime == null) {
        updated[lastSyncedIndex] = {
          ...updated[lastSyncedIndex],
          endTime: Math.max(
            updated[lastSyncedIndex].timestamp ?? 0,
            time - ((settings as EditorSettings).srt?.minSubtitleGap || 0),
          ),
        };
      }
      updated[activeLineIndex] = { ...updated[activeLineIndex], timestamp: time };
      if (skipBlank) {
        const result = stampBlanks(updated, activeLineIndex, time, true);
        updated = result.lines;
      }
      const nextIdx = autoAdvance ? computeNextIndex(lines, activeLineIndex, skipBlank) : null;
      return { nextLines: updated, nextActiveLineIndex: nextIdx, nextAwaitingEndMark: null };
    }

    if (awaitingEndMark === activeLineIndex) {
      let updated = [...lines];
      updated[activeLineIndex] = {
        ...updated[activeLineIndex],
        endTime: Math.max(updated[activeLineIndex].timestamp ?? 0, time),
      };
      if (skipBlank) {
        const result = stampBlanks(updated, activeLineIndex, time, true);
        updated = result.lines;
      }
      const nextIdx = autoAdvance ? computeNextIndex(lines, activeLineIndex, skipBlank) : null;
      return { nextLines: updated, nextActiveLineIndex: nextIdx, nextAwaitingEndMark: null };
    }

    const updated = [...lines];
    updated[activeLineIndex] = { ...updated[activeLineIndex], timestamp: time };
    return {
      nextLines: updated,
      nextActiveLineIndex: null,
      nextAwaitingEndMark: { lineIndex: activeLineIndex, mode: editorMode },
    };
  }

  let updated = [...lines];
  updated[activeLineIndex] = { ...updated[activeLineIndex], timestamp: time };
  if (skipBlank) {
    const result = stampBlanks(updated, activeLineIndex, time, false);
    updated = result.lines;
  }
  const nextIdx = autoAdvance ? computeNextIndex(lines, activeLineIndex, skipBlank) : null;
  return { nextLines: updated, nextActiveLineIndex: nextIdx, nextAwaitingEndMark: null };
}

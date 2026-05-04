/**
 * Pure functions for editor logic — no side effects, no React imports.
 * Server-side port of client/src/components/Editor/editorService.js.
 */

/**
 * Detect duplicate/overlapping timestamps within a threshold.
 */
export function detectDuplicateTimestamps(lines, threshold = 0.05) {
  const overlapping = new Set();
  const timestamped = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].timestamp != null) {
      timestamped.push({ index: i, time: lines[i].timestamp });
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

/**
 * Compute the next active line index after marking, respecting skipBlank.
 */
export function computeNextIndex(lines, fromIndex, skipBlank) {
  let nextIndex = fromIndex + 1;
  if (skipBlank) {
    while (nextIndex < lines.length) {
      const text = lines[nextIndex]?.text?.trim();
      if (text && text !== '♪') break;
      nextIndex++;
    }
  }
  return Math.min(nextIndex, lines.length - 1);
}

/**
 * Shift timestamps of all lines at the selected indices by delta.
 */
export function applyBulkShift(lines, selectedIndices, delta) {
  const numericDelta = Number(delta) || 0;
  const selected = new Set(selectedIndices);
  return lines.map((l, idx) => {
    if (!selected.has(idx) || l.timestamp == null) return l;
    const newTimestamp = Math.max(0, Number(l.timestamp) + numericDelta);
    if (isNaN(newTimestamp)) return l;
    const result = { ...l, timestamp: newTimestamp };
    if (result.endTime != null) {
      result.endTime = Math.max(0, Number(l.endTime) + numericDelta);
    }
    return result;
  });
}

/**
 * Global offset shift applied to all timestamped lines.
 */
export function applyGlobalOffset(lines, delta) {
  const numericDelta = Number(delta);
  if (isNaN(numericDelta) || numericDelta === 0) return lines;
  return lines.map((l) => ({
    ...l,
    timestamp: l.timestamp != null ? Math.max(0, l.timestamp + numericDelta) : null,
    endTime: l.endTime != null ? Math.max(0, l.endTime + numericDelta) : l.endTime,
  }));
}

/**
 * Clear all timestamps (and optionally endTimes / word times).
 */
export function clearAllTimestamps(lines, isSrt, isWords) {
  return lines.map((l) => ({
    ...l,
    timestamp: null,
    ...(isSrt && { endTime: null }),
    ...(isWords && l.words && { words: l.words.map((w) => ({ ...w, time: null })) }),
  }));
}

/**
 * Clear timestamp for a single line.
 */
export function clearLineTimestamp(lines, index, isSrt, isWords) {
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

/**
 * Stamp blank lines between fromIndex+1 and next non-blank with the given time.
 */
function stampBlanks(lines, fromIndex, time, isSrt) {
  const updated = [...lines];
  let nextIndex = fromIndex + 1;
  while (nextIndex < updated.length) {
    const text = updated[nextIndex]?.text?.trim();
    if (text && text !== '♪') break;
    nextIndex++;
  }
  for (let i = fromIndex + 1; i < nextIndex; i++) {
    updated[i] = isSrt
      ? { ...updated[i], timestamp: time, endTime: time }
      : { ...updated[i], timestamp: time };
  }
  return { lines: updated, nextBlankEnd: nextIndex };
}

/**
 * Pure function that computes the next lines state from a mark action.
 *
 * @returns {{ nextLines, nextActiveLineIndex, nextAwaitingEndMark, nextActiveWordIndex? }}
 */
export function applyMark({ lines, activeLineIndex, time, editorMode, activeWordIndex = 0, stampTarget = 'main', awaitingEndMark, focusedTimestamp, settings }) {
  if (activeLineIndex >= lines.length) {
    return { nextLines: lines, nextActiveLineIndex: null, nextAwaitingEndMark: undefined };
  }

  const skipBlank = settings.autoAdvance?.skipBlank;
  const autoAdvance = settings.autoAdvance?.enabled;
  const isSrt = editorMode === 'srt';

  // Focused timestamp takes priority
  if (focusedTimestamp) {
    const updated = [...lines];
    const line = updated[focusedTimestamp.lineIndex];
    if (line) {
      updated[focusedTimestamp.lineIndex] = {
        ...line,
        ...(focusedTimestamp.type === 'start'
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
    const words = line[wordField] || [];

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
      const newWords = [...words];
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
    if (settings.srt?.snapToNextLine) {
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
            time - (settings.srt?.minSubtitleGap || 0),
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

    // SRT non-snap mode
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

    // SRT first mark (set start time)
    const updated = [...lines];
    updated[activeLineIndex] = { ...updated[activeLineIndex], timestamp: time };
    return {
      nextLines: updated,
      nextActiveLineIndex: null,
      nextAwaitingEndMark: { lineIndex: activeLineIndex, mode: editorMode },
    };
  }

  // LRC mode
  let updated = [...lines];
  updated[activeLineIndex] = { ...updated[activeLineIndex], timestamp: time };
  if (skipBlank) {
    const result = stampBlanks(updated, activeLineIndex, time, false);
    updated = result.lines;
  }
  const nextIdx = autoAdvance ? computeNextIndex(lines, activeLineIndex, skipBlank) : null;
  return { nextLines: updated, nextActiveLineIndex: nextIdx, nextAwaitingEndMark: null };
}

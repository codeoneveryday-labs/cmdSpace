export const IS_MAC_TEXT_INPUT_PLATFORM =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

type ScheduleCompositionClear = (
  callback: () => void,
  delayMs: number,
) => void;

const LOST_COMPOSITION_END_FALLBACK_MS = 1_000;

/**
 * WebKit can end a composition through Command keydown, `input(insertText)`,
 * and xterm's deferred `compositionend` finalizer. xterm 6 can forward the
 * same commit from more than one of those callbacks. Limit duplicate filtering
 * to that finalization lifecycle so the first commit stays synchronous and
 * identical input typed later is preserved.
 */
export function createMacCompositionCommitFilter(
  scheduleClear: ScheduleCompositionClear = (callback, delayMs) => {
    setTimeout(callback, delayMs);
  },
): {
  beginKeydownFinalization: () => void;
  beginCompositionFinalization: () => void;
  shouldForward: (data: string) => boolean;
} {
  let finalizing = false;
  let firstCommit: string | null = null;
  let generation = 0;

  const beginFinalization = (clearAfterMs: number) => {
    if (!finalizing) firstCommit = null;
    finalizing = true;
    const currentGeneration = ++generation;
    scheduleClear(() => {
      if (generation !== currentGeneration) return;
      finalizing = false;
      firstCommit = null;
    }, clearAfterMs);
  };

  return {
    beginKeydownFinalization() {
      // Command can make xterm finalize synchronously before WebKit dispatches
      // compositionend. Keep the guard open across that event boundary, with a
      // fallback for the WebKit case where compositionend never arrives.
      beginFinalization(LOST_COMPOSITION_END_FALLBACK_MS);
    },
    beginCompositionFinalization() {
      // xterm registered its compositionend listener first and schedules its
      // deferred send before this listener schedules the clear.
      beginFinalization(0);
    },
    shouldForward(data) {
      if (!finalizing || !isPrintableTerminalData(data)) return true;
      if (firstCommit === null) {
        firstCommit = data;
        return true;
      }
      return data !== firstCommit;
    },
  };
}

export function normalizeMacTerminalInput(value: string): string {
  // WebKit's macOS text bridge can occasionally surface an intended space as
  // invisible C1 controls (U+0080–U+009F) or as Unicode space lookalikes
  // (no-break space U+00A0, thin/medium spaces U+2000–U+200A, narrow no-break
  // space U+202F, word joiner U+2060, ideographic space U+3000). Zsh then
  // treats both visible words as one command. Collapse every such separator
  // into a regular space so the shell can split it.
  return value.replace(
    /[\u0080-\u009f\u00a0\u2000-\u200a\u202f\u205f\u2060\u3000]+/g,
    " ",
  );
}

function isPrintableTerminalData(data: string): boolean {
  return (
    data.length > 0 &&
    Array.from(data).every(
      (character) =>
        character.charCodeAt(0) >= 0x20 && character.charCodeAt(0) !== 0x7f,
    )
  );
}

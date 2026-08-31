export const UNICODE_SPACE_OR_C1_CONTROL_PATTERN =
  /[\u0080-\u009f\u00a0\u2000-\u200a\u202f\u205f\u2060\u3000]+/g;

export const LOST_COMPOSITION_END_FALLBACK_MS = 1_000;

export type ScheduleCompositionClear = (
  callback: () => void,
  delayMs: number,
) => void;

/**
 * Normalizes C1 controls and non-standard Unicode whitespace into standard ASCII space.
 * Prevents WebKit IME space corruption (e.g. Vietnamese Telex / Japanese IME input).
 */
export function normalizeTerminalWhitespace(value: string): string {
  return value.replace(UNICODE_SPACE_OR_C1_CONTROL_PATTERN, " ");
}

export function isPrintableAsciiCharacter(charCode: number): boolean {
  return charCode >= 0x20 && charCode !== 0x7f;
}

export function isPrintableData(data: string): boolean {
  return (
    data.length > 0 &&
    Array.from(data).every((character) =>
      isPrintableAsciiCharacter(character.charCodeAt(0)),
    )
  );
}

export type CompositionCommitState = {
  finalizing: boolean;
  firstCommit: string | null;
  generation: number;
  windowBlurred: boolean;
};

export function createInitialCompositionCommitState(): CompositionCommitState {
  return {
    finalizing: false,
    firstCommit: null,
    generation: 0,
    windowBlurred: false,
  };
}

export function evaluateCommitForward(
  state: CompositionCommitState,
  data: string,
): { shouldForward: boolean; nextFirstCommit: string | null } {
  if (!state.finalizing || !isPrintableData(data)) {
    return { shouldForward: true, nextFirstCommit: state.firstCommit };
  }
  if (state.firstCommit === null) {
    return { shouldForward: true, nextFirstCommit: data };
  }
  return {
    shouldForward: data !== state.firstCommit,
    nextFirstCommit: state.firstCommit,
  };
}

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
  handleWindowBlur: () => void;
  handleWindowFocus: () => void;
  shouldForward: (data: string) => boolean;
} {
  let finalizing = false;
  let firstCommit: string | null = null;
  let generation = 0;
  let windowBlurred = false;

  const beginFinalization = (clearAfterMs: number) => {
    if (!finalizing) firstCommit = null;
    finalizing = true;
    const currentGeneration = ++generation;
    scheduleClear(() => {
      if (generation !== currentGeneration) return;
      if (windowBlurred) return;
      finalizing = false;
      firstCommit = null;
    }, clearAfterMs);
  };

  return {
    beginKeydownFinalization() {
      beginFinalization(LOST_COMPOSITION_END_FALLBACK_MS);
    },
    beginCompositionFinalization() {
      beginFinalization(0);
    },
    handleWindowBlur() {
      if (!finalizing) return;
      windowBlurred = true;
      generation += 1;
    },
    handleWindowFocus() {
      if (!finalizing || !windowBlurred) return;
      windowBlurred = false;
      beginFinalization(LOST_COMPOSITION_END_FALLBACK_MS);
    },
    shouldForward(data) {
      const evaluation = evaluateCommitForward(
        { finalizing, firstCommit, generation, windowBlurred },
        data,
      );
      firstCommit = evaluation.nextFirstCommit;
      return evaluation.shouldForward;
    },
  };
}

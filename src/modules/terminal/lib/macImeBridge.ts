import {
  createMacCompositionCommitFilter as createFilter,
  normalizeTerminalWhitespace,
  type ScheduleCompositionClear,
} from "./imeCompositionModel";
import type { Terminal } from "@xterm/xterm";

export const IS_MAC_TEXT_INPUT_PLATFORM =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

export function createMacCompositionCommitFilter(
  scheduleClear?: ScheduleCompositionClear,
) {
  return createFilter(scheduleClear);
}

export function normalizeMacTerminalInput(value: string): string {
  return normalizeTerminalWhitespace(value);
}

export function shouldUseMacTextInputPath(event: KeyboardEvent): boolean {
  if (!IS_MAC_TEXT_INPUT_PLATFORM) return false;
  if (event.type !== "keydown" && event.type !== "keypress") return false;
  if (event.ctrlKey || event.metaKey || event.altKey || event.key === " ") return false;
  return event.key.length === 1 && event.key.charCodeAt(0) >= 0x20;
}

export function shouldIgnoreMacPrintableTerminalData(data: string): boolean {
  return (
    IS_MAC_TEXT_INPUT_PLATFORM &&
    data.length === 1 &&
    data.charCodeAt(0) >= 0x20 &&
    data.charCodeAt(0) !== 0x7f
  );
}

export function createMacTextInputDeduplicator(
  writeToPty: (data: string) => void,
) {
  let pendingXtermData: string | null = null;
  let recentBridgeData: string | null = null;

  return {
    writeXtermData(data: string) {
      if (!isPrintableTerminalData(data)) {
        writeToPty(data);
        return;
      }
      if (recentBridgeData === data) return;
      pendingXtermData = data;
      queueMicrotask(() => {
        if (pendingXtermData !== data) return;
        pendingXtermData = null;
        writeToPty(data);
      });
    },
    writeBridgeData(data: string) {
      if (!data) return;
      if (pendingXtermData === data) pendingXtermData = null;
      recentBridgeData = data;
      queueMicrotask(() => {
        if (recentBridgeData === data) recentBridgeData = null;
      });
      writeToPty(data);
    },
  };
}

export function attachMacImeBridge(
  terminal: Terminal,
  writeToPty: (data: string) => void,
): void {
  if (!IS_MAC_TEXT_INPUT_PLATFORM || !terminal.textarea) return;

  const textarea = terminal.textarea;
  let lastValue = textarea.value;
  let composing = false;
  let compositionStartValue = textarea.value;

  const writeDiff = (fromValue: string) => {
    const from = normalizeMacTerminalInput(fromValue);
    const to = normalizeMacTerminalInput(textarea.value);
    if (to === from) return;

    let prefixLength = 0;
    const limit = Math.min(from.length, to.length);
    while (
      prefixLength < limit &&
      from.charCodeAt(prefixLength) === to.charCodeAt(prefixLength)
    ) {
      prefixLength += 1;
    }
    writeToPty("\x7f".repeat(from.length - prefixLength) + to.slice(prefixLength));
    lastValue = textarea.value;
  };

  textarea.addEventListener("compositionstart", (event) => {
    event.stopImmediatePropagation();
    composing = true;
    compositionStartValue = textarea.value;
  }, true);
  textarea.addEventListener("compositionupdate", (event) => {
    event.stopImmediatePropagation();
  }, true);
  textarea.addEventListener("compositionend", (event) => {
    event.stopImmediatePropagation();
    composing = false;
    writeDiff(compositionStartValue);
  }, true);
  for (const eventName of ["beforeinput", "textInput", "textinput"] as const) {
    textarea.addEventListener(eventName, (event) => event.stopImmediatePropagation(), true);
  }
  textarea.addEventListener("input", (event) => {
    event.stopImmediatePropagation();
    const input = event as InputEvent;
    if (composing || input.inputType === "insertFromPaste") {
      lastValue = textarea.value;
      return;
    }
    if (input.inputType && !input.inputType.startsWith("insert")) {
      lastValue = textarea.value;
      return;
    }
    writeDiff(lastValue);
  }, true);
  // xterm clears its hidden textarea on blur (`_handleTextAreaBlur` sets
  // value="") without firing an `input` event, so `lastValue` goes stale.
  // Without this resync, the next keystroke after refocus diffs into a run
  // of spurious DELs and wipes the shell line (blur-to-Chrome then type).
  textarea.addEventListener("focus", () => {
    lastValue = textarea.value;
  });
}

function isPrintableTerminalData(data: string): boolean {
  return (
    data.length > 0 &&
    Array.from(data).every(
      (character) => character.charCodeAt(0) >= 0x20 && character.charCodeAt(0) !== 0x7f,
    )
  );
}

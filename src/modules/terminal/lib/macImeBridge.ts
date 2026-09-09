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
  const pendingBridgeData: Array<{ data: string; expiresAt: number }> = [];
  const DEDUPE_WINDOW_MS = 250;
  const MAX_PENDING_BRIDGE_DATA = 64;

  const prunePendingBridgeData = () => {
    const now = Date.now();
    while (pendingBridgeData[0]?.expiresAt <= now) {
      pendingBridgeData.shift();
    }
  };

  return {
    writeXtermData(data: string) {
      if (!isPrintableTerminalData(data)) {
        writeToPty(data);
        return;
      }
      prunePendingBridgeData();
      const duplicateIndex = pendingBridgeData.findIndex(
        (entry) => entry.data === data,
      );
      if (duplicateIndex >= 0) {
        pendingBridgeData.splice(duplicateIndex, 1);
        return;
      }
      pendingXtermData = data;
      queueMicrotask(() => {
        if (pendingXtermData !== data) return;
        pendingXtermData = null;
        writeToPty(data);
      });
    },
    writeBridgeData(data: string) {
      if (!data) return;
      prunePendingBridgeData();
      if (isPrintableTerminalData(data)) {
        pendingBridgeData.push({
          data,
          expiresAt: Date.now() + DEDUPE_WINDOW_MS,
        });
        if (pendingBridgeData.length > MAX_PENDING_BRIDGE_DATA) {
          pendingBridgeData.splice(
            0,
            pendingBridgeData.length - MAX_PENDING_BRIDGE_DATA,
          );
        }
      }
      if (pendingXtermData === data) pendingXtermData = null;
      writeToPty(data);
    },
  };
}

export function attachMacImeBridge(
  terminal: Terminal,
  writeToPty: (data: string) => void,
): (() => void) | undefined {
  if (!IS_MAC_TEXT_INPUT_PLATFORM || !terminal.textarea) return undefined;

  const textarea = terminal.textarea;
  let lastValue = textarea.value;
  let composing = false;
  let compositionStartValue = textarea.value;

  const resetCompositionState = () => {
    composing = false;
    compositionStartValue = textarea.value;
    lastValue = textarea.value;
  };

  const cancelCompositionOnBlur = () => {
    if (!composing) return;

    // xterm clears the helper textarea during blur, but its CompositionHelper
    // does not receive a matching compositionend in every WebKit path. Clear
    // any marked text and send a synthetic end so xterm drops its composing
    // state before the next refocus.
    textarea.value = "";
    resetCompositionState();
    textarea.dispatchEvent(new Event("compositionend", { bubbles: true }));
  };

  const ownerWindow = textarea.ownerDocument?.defaultView;
  ownerWindow?.addEventListener("blur", cancelCompositionOnBlur);
  const removeWindowBlurListener = () => {
    ownerWindow?.removeEventListener("blur", cancelCompositionOnBlur);
  };

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

  // xterm's CompositionHelper owns the visible preedit. These listeners only
  // mirror lifecycle state for the fallback writer and intentionally do not
  // stop propagation, so compositionupdate can repaint immediately.
  textarea.addEventListener("compositionstart", () => {
    composing = true;
    compositionStartValue = textarea.value;
  }, true);
  textarea.addEventListener("compositionend", (event) => {
    // Synthetic compositionend events are only used to cancel a composition
    // that was interrupted by blur; never turn the marked text into PTY input.
    if (event.isTrusted === false) {
      resetCompositionState();
      return;
    }
    composing = false;
    writeDiff(compositionStartValue);
  }, true);
  textarea.addEventListener("input", (event) => {
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
  textarea.addEventListener("blur", cancelCompositionOnBlur);
  return removeWindowBlurListener;
}

function isPrintableTerminalData(data: string): boolean {
  return (
    data.length > 0 &&
    Array.from(data).every(
      (character) => character.charCodeAt(0) >= 0x20 && character.charCodeAt(0) !== 0x7f,
    )
  );
}

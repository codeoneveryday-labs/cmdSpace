import { usePreferencesStore } from "@/modules/settings/preferences";
import { Terminal } from "@xterm/xterm";
import { terminalLineBoundarySequence, terminalWordNavigationSequence } from "./keymap";
import { createMacCompositionCommitFilter, IS_MAC_TEXT_INPUT_PLATFORM, normalizeMacTerminalInput } from "./macImeBridge";
import { isTerminalCopyShortcut, terminalEditingSequence } from "./terminalInputShortcuts";
import { traceTerminalInput } from "./terminal-native";
import type { Slot, SlotAdapter } from "./rendererPool";

const AUTO_COPY_SELECTION_DEBOUNCE_MS = 120;
const AUTO_COPY_BADGE_MS = 1_200;
const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);
const OSC_COLOR_REPORT = /^(?:\x1b](?:10|11);rgb:[0-9a-f]{4}\/[0-9a-f]{4}\/[0-9a-f]{4}\x1b\\)+$/i;

type RendererInputSlot = Pick<Slot, "term" | "host" | "currentLeafId" | "autoCopyTimer" | "copyBadgeTimer" | "copyBadge" | "lastAutoCopiedSelection">;

export function configureRendererInput(
  slot: RendererInputSlot,
  adapter: Pick<SlotAdapter, "resolveLeaf">,
): void {
    const compositionCommitFilter = createMacCompositionCommitFilter();
    if (IS_MAC_TEXT_INPUT_PLATFORM) {
      slot.term.textarea?.addEventListener(
        "compositionend",
        compositionCommitFilter.beginCompositionFinalization,
      );
      slot.host.ownerDocument.defaultView?.addEventListener(
        "blur",
        compositionCommitFilter.handleWindowBlur,
      );
      slot.host.ownerDocument.defaultView?.addEventListener(
        "focus",
        compositionCommitFilter.handleWindowFocus,
      );
    }
    attachCopyOnSelection(slot);
    slot.term.attachCustomKeyEventHandler((event) => {
      // If the user is currently composing an IME character (e.g. Vietnamese Telex),
      // let xterm's internal textarea handle it without custom key intercepts.
      if (event.isComposing || event.keyCode === 229 || event.key === "Process") {
        if (event.type === "keydown" && event.metaKey) {
          compositionCommitFilter.beginKeydownFinalization();
        }
        return true;
      }

      const lineBoundary = terminalLineBoundarySequence(event);
      if (lineBoundary) {
        const leafId = slot.currentLeafId;
        if (leafId === null) return false;
        const bridge = adapter?.resolveLeaf(leafId);
        if (!bridge) return true;
        event.preventDefault();
        if (event.type === "keydown") bridge.writeToPty(lineBoundary);
        return false;
      }

      // Keep Command + Arrows without Shift available for global pane navigation.
      if (event.metaKey && event.key.startsWith("Arrow")) {
        return false;
      }

      const leafId = slot.currentLeafId;
      if (leafId === null) return false;
      const bridge = adapter?.resolveLeaf(leafId);
      if (!bridge) return true;
      const wordNavigation = terminalWordNavigationSequence(event);
      if (wordNavigation) {
        event.preventDefault();
        if (event.type === "keydown") bridge.writeToPty(wordNavigation);
        return false;
      }
      const editingSequence = terminalEditingSequence(event, IS_MAC);
      if (editingSequence) {
        event.preventDefault();
        if (event.type === "keydown") bridge.writeToPty(editingSequence);
        return false;
      }
      if (isTerminalCopyShortcut(event, IS_MAC)) {
        if (event.type === "keydown" && slot.term.hasSelection()) {
          const sel = slot.term.getSelection();
          if (sel) writeSelectionToClipboard(slot, sel);
        }
        event.preventDefault();
        return false;
      }
      return true;
    });

    slot.term.onData((data) => {
      const leafId = slot.currentLeafId;
      if (leafId === null) return;

      // xterm emits OSC 10/11 color reports on its input channel. They are
      // terminal metadata, not user input; forwarding them can corrupt zsh's
      // history recall when a report arrives alongside an arrow key sequence.
      if (OSC_COLOR_REPORT.test(data)) return;

      const bridge = adapter?.resolveLeaf(leafId);
      if (!bridge) return;
      // WebKit on macOS can surface space characters in clipboard content as
      // invisible C1 control chars (U+0080–U+009F), causing pasted words to
      // fuse into a single token at the shell. xterm's native paste listener
      // feeds this path, so normalize before forwarding to the PTY.
      const normalized = IS_MAC_TEXT_INPUT_PLATFORM
        ? normalizeMacTerminalInput(data)
        : data;
      if (!compositionCommitFilter.shouldForward(normalized)) return;
      void traceTerminalInput("xterm-ondata", normalized);
      if (normalized.includes("\r") || normalized.includes("\n")) {
        bridge.observeInputLine?.(currentInputLine(slot.term));
      }
      bridge.writeToPty(normalized);
    });

  function currentInputLine(term: Terminal): string {
    const buffer = term.buffer.active;
    return (
      buffer
        .getLine(buffer.baseY + buffer.cursorY)
        ?.translateToString(true) ?? ""
    );
  }

  function attachCopyOnSelection(slot: RendererInputSlot): void {
    slot.term.onSelectionChange(() => {
      if (slot.autoCopyTimer) clearTimeout(slot.autoCopyTimer);
      slot.autoCopyTimer = setTimeout(() => {
        slot.autoCopyTimer = null;
        if (!usePreferencesStore.getState().terminalCopyOnSelection) return;

        const selection = slot.term.getSelection();
        if (!selection) {
          slot.lastAutoCopiedSelection = "";
          return;
        }
        if (selection === slot.lastAutoCopiedSelection) return;

        slot.lastAutoCopiedSelection = selection;
        writeSelectionToClipboard(slot, selection, true);
      }, AUTO_COPY_SELECTION_DEBOUNCE_MS);
    });
  }

  function writeSelectionToClipboard(
    slot: RendererInputSlot,
    selection: string,
    clearSelectionAfterCopy = false,
  ): void {
    void navigator.clipboard
      .writeText(selection)
      .then(() => {
        showAutoCopyBadge(slot);
        if (clearSelectionAfterCopy) slot.term.clearSelection();
      })
      .catch(() => {});
  }

  function showAutoCopyBadge(slot: RendererInputSlot): void {
    let badge = slot.copyBadge;
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "cmdspace-terminal-copy-badge";
      badge.setAttribute("role", "status");
      badge.setAttribute("aria-live", "polite");
    slot.host.appendChild(badge);
      slot.copyBadge = badge;
    }

    badge.textContent = "Copied";
    badge.classList.add("is-visible");
    if (slot.copyBadgeTimer) clearTimeout(slot.copyBadgeTimer);
    slot.copyBadgeTimer = setTimeout(() => {
      badge.classList.remove("is-visible");
      slot.copyBadgeTimer = null;
    }, AUTO_COPY_BADGE_MS);
  }
}

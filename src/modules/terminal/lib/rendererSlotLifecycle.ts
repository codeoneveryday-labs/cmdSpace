import type { AcquireParams, Slot, SlotAdapter } from "./rendererPool";
import {
  DARK_TERMINAL_THEME,
  buildTerminalTheme,
} from "@/styles/terminalTheme";

type ResizePort = {
  setupResizeObserver: (slot: Slot, params: AcquireParams) => void;
  fitSlot: (slot: Slot) => void;
  schedulePostLayoutFit: (slot: Slot) => void;
  clearSlotResizeTimers: (slot: Slot) => void;
  removePendingResize: (slot: Slot) => void;
};

type SlotLifecycleRuntime = {
  resize: ResizePort;
  getAdapter: () => SlotAdapter | null;
  getRecycler: () => HTMLDivElement;
  clearSlotAutoCopyTimer: (slot: Slot) => void;
  applyCursorStyle: (slot: Slot) => void;
  applyCursorBlink: (slot: Slot, focused: boolean) => void;
};

export function createRendererSlotLifecycle(runtime: SlotLifecycleRuntime) {
  function scheduleUnhide(slot: Slot): void {
    slot.unhideRaf = requestAnimationFrame(() => {
      slot.unhideRaf = requestAnimationFrame(() => {
        slot.unhideRaf = null;
        slot.host.style.visibility = "";
        const leafId = slot.currentLeafId;
        if (leafId !== null && runtime.getAdapter()?.isLeafFocused(leafId)) {
          slot.term.focus();
        }
      });
    });
  }

  function cancelPendingUnhide(slot: Slot): void {
    if (slot.unhideRaf !== null) {
      cancelAnimationFrame(slot.unhideRaf);
      slot.unhideRaf = null;
    }
  }

  function bindSlot(slot: Slot, params: AcquireParams): void {
    slot.currentLeafId = params.leafId;
    slot.lastUsedAt = performance.now();

    cancelPendingUnhide(slot);
    slot.host.style.visibility = "hidden";
    if (slot.host.parentNode !== params.container) {
      params.container.appendChild(slot.host);
    }

    slot.term.options.disableStdin = params.shellExited;
    slot.term.clear();
    slot.term.reset();

    const bridge = runtime.getAdapter()?.resolveLeaf(params.leafId);
    if (bridge?.isDarkAgent?.() || bridge?.isHerdr?.()) {
      slot.term.options.theme = DARK_TERMINAL_THEME;
      slot.host.style.backgroundColor = "#09090b";
    } else {
      slot.term.options.theme = buildTerminalTheme();
      slot.host.style.backgroundColor = "";
    }
    if (
      params.cols > 0 &&
      params.rows > 0 &&
      (slot.term.cols !== params.cols || slot.term.rows !== params.rows)
    ) {
      slot.term.resize(params.cols, params.rows);
    }

    if (params.snapshot) {
      try {
        slot.term.write(params.snapshot);
      } catch (error) {
        console.warn("[cmdspace] snapshot replay failed:", error);
      }
    }
    if (params.altScreen) {
      // Cursor-positioned TUI output cannot be coherently replayed over a
      // dormant snapshot; discard it and use the SIGWINCH kick below.
      params.drainRing(() => {});
    } else {
      params.drainRing((bytes) => slot.term.write(bytes));
    }
    try {
      slot.term.write("\x1b[?25h");
    } catch {}

    for (const dispose of slot.oscDisposers) {
      try {
        dispose();
      } catch {}
    }
    slot.oscDisposers = params.registerOsc(slot.term);

    runtime.resize.setupResizeObserver(slot, params);
    runtime.resize.fitSlot(slot);
    runtime.resize.schedulePostLayoutFit(slot);
    slot.lastCols = slot.term.cols;
    slot.lastRows = slot.term.rows;
    slot.lastW = params.container.clientWidth;
    slot.lastH = params.container.clientHeight;
    runtime.getAdapter()?.resolveLeaf(params.leafId)?.resizePty(
      slot.lastCols,
      slot.lastRows,
    );

    if (params.searchQuery) {
      try {
        slot.searchAddon.findNext(params.searchQuery);
      } catch {}
    }
    runtime.applyCursorBlink(
      slot,
      runtime.getAdapter()?.isLeafFocused(params.leafId) ?? false,
    );
    if (params.altScreen && !params.shellExited) {
      runtime.getAdapter()?.resolveLeaf(params.leafId)?.kickPty(
        slot.term.cols,
        slot.term.rows,
      );
    }

    scheduleUnhide(slot);
    params.onSearchReady(slot.searchAddon);
  }

  function rewireSlot(slot: Slot, params: AcquireParams): void {
    slot.lastUsedAt = performance.now();
    runtime.applyCursorStyle(slot);
    if (slot.host.parentNode !== params.container) {
      params.container.appendChild(slot.host);
    }
    runtime.resize.setupResizeObserver(slot, params);
    runtime.resize.fitSlot(slot);
    runtime.resize.schedulePostLayoutFit(slot);
    slot.lastW = params.container.clientWidth;
    slot.lastH = params.container.clientHeight;
    runtime.getAdapter()?.resolveLeaf(params.leafId)?.resizePty(
      slot.term.cols,
      slot.term.rows,
    );
    slot.lastCols = slot.term.cols;
    slot.lastRows = slot.term.rows;
    params.onSearchReady(slot.searchAddon);
  }

  function detachSlotFromLeaf(slot: Slot): void {
    for (const dispose of slot.oscDisposers) {
      try {
        dispose();
      } catch {}
    }
    slot.oscDisposers = [];
    slot.observer?.disconnect();
    slot.observer = null;
    runtime.resize.clearSlotResizeTimers(slot);
    runtime.clearSlotAutoCopyTimer(slot);
    runtime.resize.removePendingResize(slot);
    cancelPendingUnhide(slot);
    slot.host.style.visibility = "";
    if (slot.host.parentNode !== runtime.getRecycler()) {
      runtime.getRecycler().appendChild(slot.host);
    }
    slot.currentLeafId = null;
    slot.lastUsedAt = performance.now();
  }

  return { bindSlot, rewireSlot, detachSlotFromLeaf };
}

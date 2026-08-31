import type { AcquireParams, Slot, SlotAdapter } from "./rendererPool";

const FIT_DEBOUNCE_MS = 8;
const PTY_RESIZE_DEBOUNCE_MS = 32;

type RendererResizeRuntime = {
  slots: Slot[];
  pendingResizeSlots: Set<Slot>;
  getRecycler: () => HTMLDivElement;
  getAdapter: () => SlotAdapter | null;
};

export function createRendererResizeController(
  runtime: RendererResizeRuntime,
) {
  let terminalResizePaused = false;

  function fitSlot(slot: Slot): void {
    const container = slot.host.parentElement;
    if (!container || container.clientWidth <= 0 || container.clientHeight <= 0) {
      return;
    }
    const dims = slot.fitAddon.proposeDimensions();
    if (dims) {
      const cols = Math.max(10, Math.floor(dims.cols));
      const rows = Math.max(3, Math.floor(dims.rows));
      if (slot.term.cols !== cols || slot.term.rows !== rows) {
        slot.term.resize(cols, rows);
      }
    }
  }

  function clearSlotResizeTimers(slot: Slot): void {
    if (slot.fitTimer) clearTimeout(slot.fitTimer);
    if (slot.ptyTimer) clearTimeout(slot.ptyTimer);
    slot.fitTimer = null;
    slot.ptyTimer = null;
  }

  function refreshSlot(slot: Slot): void {
    try {
      slot.term.refresh(0, Math.max(0, slot.term.rows - 1));
    } catch {
      // A slot can be disposed between ResizeObserver and the repaint frame.
    }
  }

  function fitSlotFromCurrentHost(slot: Slot): void {
    const leafId = slot.currentLeafId;
    if (leafId === null) return;
    const container = slot.host.parentElement;
    if (!container || container === runtime.getRecycler()) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;
    slot.lastW = w;
    slot.lastH = h;
    fitSlot(slot);
    refreshSlot(slot);
    if (slot.term.cols === slot.lastCols && slot.term.rows === slot.lastRows) {
      return;
    }
    slot.lastCols = slot.term.cols;
    slot.lastRows = slot.term.rows;
    runtime.getAdapter()?.resolveLeaf(leafId)?.resizePty(slot.lastCols, slot.lastRows);
  }

  function schedulePostLayoutFit(slot: Slot): void {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (slot.currentLeafId !== null) fitSlotFromCurrentHost(slot);
      });
    });
  }

  function setupResizeObserver(slot: Slot, p: AcquireParams): void {
    slot.observer?.disconnect();
    clearSlotResizeTimers(slot);

    const container = p.container;
    const flushPty = () => {
      slot.ptyTimer = null;
      if (slot.currentLeafId !== p.leafId) return;
      if (slot.term.cols === slot.lastCols && slot.term.rows === slot.lastRows) {
        return;
      }
      slot.lastCols = slot.term.cols;
      slot.lastRows = slot.term.rows;
      runtime.getAdapter()?.resolveLeaf(p.leafId)?.resizePty(
        slot.lastCols,
        slot.lastRows,
      );
    };

    slot.observer = new ResizeObserver(() => {
      if (terminalResizePaused) {
        runtime.pendingResizeSlots.add(slot);
        return;
      }
      if (slot.fitTimer) clearTimeout(slot.fitTimer);
      slot.fitTimer = setTimeout(() => {
        slot.fitTimer = null;
        if (slot.currentLeafId !== p.leafId) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        if (w === slot.lastW && h === slot.lastH) return;
        slot.lastW = w;
        slot.lastH = h;
        fitSlot(slot);
        if (slot.ptyTimer) clearTimeout(slot.ptyTimer);
        slot.ptyTimer = setTimeout(flushPty, PTY_RESIZE_DEBOUNCE_MS);
      }, FIT_DEBOUNCE_MS);
    });
    slot.observer.observe(container);
  }

  function setTerminalResizePaused(paused: boolean): void {
    if (terminalResizePaused === paused) return;
    terminalResizePaused = paused;

    if (paused) {
      for (const slot of runtime.slots) clearSlotResizeTimers(slot);
      return;
    }

    const targets = new Set(
      runtime.slots.filter((slot) => slot.currentLeafId !== null),
    );
    for (const slot of runtime.pendingResizeSlots) targets.add(slot);
    runtime.pendingResizeSlots.clear();

    for (const slot of targets) {
      clearSlotResizeTimers(slot);
      fitSlotFromCurrentHost(slot);
    }
  }

  return {
    fitSlot,
    clearSlotResizeTimers,
    fitSlotFromCurrentHost,
    schedulePostLayoutFit,
    setupResizeObserver,
    setTerminalResizePaused,
    removePendingResize(slot: Slot) {
      runtime.pendingResizeSlots.delete(slot);
    },
  };
}

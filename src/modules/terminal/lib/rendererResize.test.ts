import { afterEach, describe, expect, it, vi } from "vitest";
import { createRendererResizeController } from "./rendererResize";
import type { AcquireParams, Slot } from "./rendererPool";

type FakeElement = {
  clientWidth: number;
  clientHeight: number;
  parentElement: FakeElement | null;
};

function createSlot(container: FakeElement): Slot {
  const term = {
    cols: 80,
    rows: 24,
    resize: vi.fn((cols: number, rows: number) => {
      term.cols = cols;
      term.rows = rows;
    }),
    refresh: vi.fn(),
  };
  return {
    currentLeafId: 42,
    host: { parentElement: container },
    fitAddon: { proposeDimensions: () => ({ cols: 120, rows: 40 }) },
    term,
    fitTimer: null,
    ptyTimer: null,
    lastW: 0,
    lastH: 0,
    lastCols: 80,
    lastRows: 24,
  } as unknown as Slot;
}

function params(container: FakeElement): AcquireParams {
  return {
    leafId: 42,
    container: container as HTMLDivElement,
    snapshot: null,
    altScreen: false,
    drainRing: () => undefined,
    shellExited: false,
    searchQuery: null,
    cols: 80,
    rows: 24,
    registerOsc: () => [],
    onSearchReady: () => undefined,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("rendererResize", () => {
  it("defers a resize notification while chrome is resizing, then fits and resizes the PTY once resumed", () => {
    let onResize: (() => void) | undefined;
    const observe = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: () => void) {
          onResize = callback;
        }
        observe = observe;
        disconnect = vi.fn();
      },
    );
    const container: FakeElement = {
      clientWidth: 900,
      clientHeight: 600,
      parentElement: null,
    };
    const recycler: FakeElement = {
      clientWidth: 0,
      clientHeight: 0,
      parentElement: null,
    };
    const slot = createSlot(container);
    const pendingResizeSlots = new Set<Slot>();
    const resizePty = vi.fn();
    const controller = createRendererResizeController({
      slots: [slot],
      pendingResizeSlots,
      getRecycler: () => recycler as HTMLDivElement,
      getAdapter: () => ({
        resolveLeaf: () => ({ writeToPty: vi.fn(), resizePty, kickPty: vi.fn() }),
        evictLeaf: vi.fn(),
        isLeafFocused: () => true,
      }),
    });

    controller.setupResizeObserver(slot, params(container));
    controller.setTerminalResizePaused(true);
    onResize?.();

    expect(pendingResizeSlots).toEqual(new Set([slot]));
    expect(slot.term.resize).not.toHaveBeenCalled();
    expect(resizePty).not.toHaveBeenCalled();

    controller.setTerminalResizePaused(false);

    expect(pendingResizeSlots).toEqual(new Set());
    expect(slot.term.resize).toHaveBeenCalledWith(120, 40);
    expect(slot.term.refresh).toHaveBeenCalledWith(0, 39);
    expect(resizePty).toHaveBeenCalledWith(120, 40);
    expect(observe).toHaveBeenCalledWith(container);
  });

  it("repaints after a host resize even when the terminal grid dimensions stay the same", () => {
    const container: FakeElement = {
      clientWidth: 900,
      clientHeight: 600,
      parentElement: null,
    };
    const recycler: FakeElement = {
      clientWidth: 0,
      clientHeight: 0,
      parentElement: null,
    };
    const slot = createSlot(container);
    const term = slot.term as unknown as { cols: number; rows: number };
    term.cols = 120;
    term.rows = 40;
    slot.lastCols = 120;
    slot.lastRows = 40;
    slot.lastW = 800;
    slot.lastH = 600;
    const resizePty = vi.fn();
    const controller = createRendererResizeController({
      slots: [slot],
      pendingResizeSlots: new Set(),
      getRecycler: () => recycler as HTMLDivElement,
      getAdapter: () => ({
        resolveLeaf: () => ({ writeToPty: vi.fn(), resizePty, kickPty: vi.fn() }),
        evictLeaf: vi.fn(),
        isLeafFocused: () => true,
      }),
    });

    controller.fitSlotFromCurrentHost(slot);

    expect(slot.term.resize).not.toHaveBeenCalled();
    expect(slot.term.refresh).toHaveBeenCalledWith(0, 39);
    expect(resizePty).not.toHaveBeenCalled();
  });
});

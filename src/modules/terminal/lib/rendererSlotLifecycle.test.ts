import { afterEach, describe, expect, it, vi } from "vitest";
import { createRendererSlotLifecycle } from "./rendererSlotLifecycle";
import type { Slot } from "./rendererPool";

type FakeElement = {
  style: { visibility: string };
  parentNode: FakeElement | null;
  parentElement: FakeElement | null;
  clientWidth: number;
  clientHeight: number;
  appendChild(child: FakeElement): void;
};

function createElement(width = 0, height = 0): FakeElement {
  const element: FakeElement = {
    style: { visibility: "" },
    parentNode: null,
    parentElement: null,
    clientWidth: width,
    clientHeight: height,
    appendChild(child) {
      child.parentNode = element;
      child.parentElement = element;
    },
  };
  return element;
}

function createSlot(host: FakeElement): Slot {
  const term = {
    cols: 80,
    rows: 24,
    options: {},
    clear: vi.fn(),
    reset: vi.fn(),
    resize: vi.fn((cols: number, rows: number) => {
      term.cols = cols;
      term.rows = rows;
    }),
    write: vi.fn(),
    focus: vi.fn(),
  };
  return {
    currentLeafId: null,
    lastUsedAt: 0,
    unhideRaf: null,
    host,
    oscDisposers: [],
    observer: null,
    autoCopyTimer: null,
    term,
    searchAddon: { findNext: vi.fn() },
  } as unknown as Slot;
}

function createLifecycle() {
  const resize = {
    setupResizeObserver: vi.fn(),
    fitSlot: vi.fn(),
    schedulePostLayoutFit: vi.fn(),
    clearSlotResizeTimers: vi.fn(),
    removePendingResize: vi.fn(),
  };
  const bridge = { writeToPty: vi.fn(), resizePty: vi.fn(), kickPty: vi.fn() };
  const recycler = createElement();
  const clearSlotAutoCopyTimer = vi.fn();
  const lifecycle = createRendererSlotLifecycle({
    resize,
    getAdapter: () => ({
      resolveLeaf: () => bridge,
      evictLeaf: vi.fn(),
      isLeafFocused: () => false,
    }),
    getRecycler: () => recycler as HTMLDivElement,
    clearSlotAutoCopyTimer,
    applyCursorStyle: vi.fn(),
    applyCursorBlink: vi.fn(),
  });
  return { lifecycle, resize, bridge, recycler, clearSlotAutoCopyTimer };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("rendererSlotLifecycle", () => {
  it("binds a standard terminal by restoring its snapshot and dormant output before resizing its PTY", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    const host = createElement();
    const container = createElement(900, 600);
    const slot = createSlot(host);
    const { lifecycle, resize, bridge } = createLifecycle();
    const drainRing = vi.fn((write: (bytes: Uint8Array) => void) => {
      write(new Uint8Array([104, 105]));
    });
    const registerOsc = vi.fn(() => []);
    const onSearchReady = vi.fn();

    lifecycle.bindSlot(slot, {
      leafId: 42,
      container: container as HTMLDivElement,
      snapshot: "previous output",
      altScreen: false,
      drainRing,
      shellExited: false,
      searchQuery: "needle",
      cols: 120,
      rows: 40,
      registerOsc,
      onSearchReady,
    });

    expect(slot.currentLeafId).toBe(42);
    expect(host.parentNode).toBe(container);
    expect(slot.term.write).toHaveBeenNthCalledWith(1, "previous output");
    expect(slot.term.write).toHaveBeenNthCalledWith(2, new Uint8Array([104, 105]));
    expect(slot.term.write).toHaveBeenLastCalledWith("\u001b[?25h");
    expect(drainRing).toHaveBeenCalledOnce();
    expect(slot.term.resize).toHaveBeenCalledWith(120, 40);
    expect(resize.setupResizeObserver).toHaveBeenCalledWith(slot, expect.any(Object));
    expect(bridge.resizePty).toHaveBeenCalledWith(120, 40);
    expect(slot.searchAddon.findNext).toHaveBeenCalledWith("needle");
    expect(onSearchReady).toHaveBeenCalledWith(slot.searchAddon);
  });

  it("binds an alt-screen terminal without replaying dormant output and asks its PTY to repaint", () => {
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
    const host = createElement();
    const container = createElement(900, 600);
    const slot = createSlot(host);
    const { lifecycle, bridge } = createLifecycle();
    const dormantOutput = new Uint8Array([104, 105]);
    const drainRing = vi.fn((write: (bytes: Uint8Array) => void) => {
      write(dormantOutput);
    });

    lifecycle.bindSlot(slot, {
      leafId: 42,
      container: container as HTMLDivElement,
      snapshot: "previous output",
      altScreen: true,
      drainRing,
      shellExited: false,
      searchQuery: null,
      cols: 120,
      rows: 40,
      registerOsc: () => [],
      onSearchReady: vi.fn(),
    });

    expect(drainRing).toHaveBeenCalledOnce();
    expect(slot.term.write).not.toHaveBeenCalledWith(dormantOutput);
    expect(bridge.kickPty).toHaveBeenCalledWith(120, 40);
  });

  it("detaches a slot by releasing subscriptions, resize work, auto-copy state, and the live leaf identity", () => {
    const host = createElement();
    const container = createElement();
    container.appendChild(host);
    const slot = createSlot(host);
    const disposeOsc = vi.fn();
    const disconnectObserver = vi.fn();
    slot.currentLeafId = 42;
    slot.oscDisposers = [disposeOsc];
    slot.observer = { disconnect: disconnectObserver } as unknown as ResizeObserver;
    slot.unhideRaf = 7;
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const { lifecycle, resize, recycler, clearSlotAutoCopyTimer } = createLifecycle();

    lifecycle.detachSlotFromLeaf(slot);

    expect(disposeOsc).toHaveBeenCalledOnce();
    expect(disconnectObserver).toHaveBeenCalledOnce();
    expect(resize.clearSlotResizeTimers).toHaveBeenCalledWith(slot);
    expect(resize.removePendingResize).toHaveBeenCalledWith(slot);
    expect(clearSlotAutoCopyTimer).toHaveBeenCalledWith(slot);
    expect(host.parentNode).toBe(recycler);
    expect(slot.currentLeafId).toBeNull();
    expect(slot.oscDisposers).toEqual([]);
    expect(slot.observer).toBeNull();
    expect(slot.unhideRaf).toBeNull();
  });
});

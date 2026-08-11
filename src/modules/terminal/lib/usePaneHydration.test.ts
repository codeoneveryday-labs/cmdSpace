import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPaneHydrationController,
  scheduleIdlePaneRestore,
  TERMINAL_LAZY_RESTORE_DELAY_MS,
  usePaneHydration,
} from "./usePaneHydration";

type ManualTask = {
  id: number;
  callback: () => void;
  cancelled: boolean;
};

function createManualScheduler() {
  const tasks = new Map<number, ManualTask>();
  let nextId = 1;

  return {
    schedule(callback: () => void) {
      const task: ManualTask = {
        id: nextId++,
        callback,
        cancelled: false,
      };
      tasks.set(task.id, task);
      return () => {
        task.cancelled = true;
      };
    },
    run(id: number) {
      tasks.get(id)?.callback();
    },
    task(id: number) {
      return tasks.get(id) ?? null;
    },
  };
}

describe("usePaneHydration", () => {
  const originalWindow = (globalThis as { window?: Window & typeof globalThis }).window;

  function setTestWindow(value: Partial<Window>) {
    (globalThis as { window?: Window & typeof globalThis }).window =
      value as unknown as Window & typeof globalThis;
  }

  function clearIdleCallbacks() {
    const testWindow = globalThis.window as unknown as {
      requestIdleCallback?: typeof window.requestIdleCallback;
      cancelIdleCallback?: typeof window.cancelIdleCallback;
    };
    delete testWindow.requestIdleCallback;
    delete testWindow.cancelIdleCallback;
  }

  afterEach(() => {
    vi.useRealTimers();
    if (originalWindow) {
      (globalThis as { window?: Window & typeof globalThis }).window =
        originalWindow;
    } else {
      delete (globalThis as { window?: Window & typeof globalThis }).window;
    }
  });

  it("exports the hook surface for parent wiring", () => {
    expect(typeof usePaneHydration).toBe("function");
  });

  it("hydrates the active leaf immediately and restores inactive leaves one idle slot at a time", () => {
    const scheduler = createManualScheduler();
    const controller = createPaneHydrationController({
      activeLeafId: 11,
      renderLeafIds: [11, 22, 33],
      scopeKey: "tab-1",
      schedule: scheduler.schedule,
    });

    expect(controller.isLeafHydrated(11)).toBe(true);
    expect(controller.isLeafHydrated(22)).toBe(false);
    expect(controller.isLeafHydrated(33)).toBe(false);

    scheduler.run(1);
    expect(controller.isLeafHydrated(22)).toBe(true);
    expect(controller.isLeafHydrated(33)).toBe(false);

    scheduler.run(2);
    expect(controller.isLeafHydrated(33)).toBe(true);
  });

  it("uses requestIdleCallback when available and falls back to the configured timeout otherwise", async () => {
    let idleRuns = 0;
    const requestIdleCallback = vi.fn((callback: IdleRequestCallback, options?: IdleRequestOptions) => {
      expect(options).toEqual({
        timeout: TERMINAL_LAZY_RESTORE_DELAY_MS * 3,
      });
      callback({
        didTimeout: false,
        timeRemaining: () => 16,
      } as IdleDeadline);
      return 7;
    });
    const cancelIdleCallback = vi.fn();

    setTestWindow({
      requestIdleCallback,
      cancelIdleCallback,
    });

    const cancelIdle = scheduleIdlePaneRestore(() => {
      idleRuns += 1;
    });
    expect(idleRuns).toBe(1);
    cancelIdle();
    expect(cancelIdleCallback).toHaveBeenCalledWith(7);

    vi.useFakeTimers();
    clearIdleCallbacks();

    let timeoutRuns = 0;
    const cancelTimeout = scheduleIdlePaneRestore(() => {
      timeoutRuns += 1;
    });
    expect(timeoutRuns).toBe(0);

    await vi.advanceTimersByTimeAsync(TERMINAL_LAZY_RESTORE_DELAY_MS - 1);
    expect(timeoutRuns).toBe(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(timeoutRuns).toBe(1);

    cancelTimeout();
  });

  it("cancels stale restore work when the selected tree changes", () => {
    const scheduler = createManualScheduler();
    const controller = createPaneHydrationController({
      activeLeafId: 1,
      renderLeafIds: [1, 2, 3],
      scopeKey: "tab-1",
      schedule: scheduler.schedule,
    });

    const staleTask = scheduler.task(1);
    expect(staleTask?.cancelled).toBe(false);

    controller.update({
      activeLeafId: 1,
      renderLeafIds: [1, 3],
      scopeKey: "tab-1",
    });

    expect(staleTask?.cancelled).toBe(true);

    staleTask?.callback();
    expect(controller.isLeafHydrated(2)).toBe(false);

    scheduler.run(2);
    expect(controller.isLeafHydrated(3)).toBe(true);
  });

  it("treats manual hydration as idempotent and skips already hydrated leaves in later idle work", () => {
    const scheduler = createManualScheduler();
    const controller = createPaneHydrationController({
      activeLeafId: 1,
      renderLeafIds: [1, 2, 3],
      scopeKey: "tab-1",
      schedule: scheduler.schedule,
    });

    controller.hydrateLeaf(2);
    controller.hydrateLeaf(2);

    expect(controller.isLeafHydrated(2)).toBe(true);
    expect(controller.isLeafHydrated(3)).toBe(false);

    scheduler.run(1);
    expect(controller.isLeafHydrated(2)).toBe(true);
    expect(controller.isLeafHydrated(3)).toBe(true);
  });
});

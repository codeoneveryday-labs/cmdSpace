import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createHoldOptionController,
  type HoldOptionKeyEvent,
} from "./useHoldOptionToTalk";

const event = (patch: Partial<HoldOptionKeyEvent> = {}): HoldOptionKeyEvent => ({
  code: "AltLeft",
  key: "Alt",
  repeat: false,
  ...patch,
});

describe("hold Option voice controller", () => {
  beforeEach(() => vi.useFakeTimers());

  it("arms after 320ms and stops on release", () => {
    const start = vi.fn();
    const stop = vi.fn();
    const target = { kind: "terminal-pane" as const, tabId: 1, terminalId: 2 };
    const controller = createHoldOptionController({
      isEnabled: () => true,
      captureTarget: () => target,
      start,
      stop,
      armMs: 320,
    });

    controller.keydown(event());
    vi.advanceTimersByTime(319);
    expect(start).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(start).toHaveBeenCalledWith(target);

    controller.keyup(event());
    expect(stop).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it("does not arm an Option plus key combo and stops on blur", () => {
    const start = vi.fn();
    const stop = vi.fn();
    const controller = createHoldOptionController({
      isEnabled: () => true,
      captureTarget: () => ({ kind: "terminal-pane", tabId: 1, terminalId: 2 }),
      start,
      stop,
      armMs: 320,
    });

    controller.keydown(event());
    controller.keydown(event({ code: "KeyK", key: "k" }));
    vi.advanceTimersByTime(320);
    expect(start).not.toHaveBeenCalled();

    controller.keyup(event());
    controller.keydown(event());
    vi.advanceTimersByTime(320);
    controller.blur();
    expect(stop).toHaveBeenCalledTimes(1);
    controller.dispose();
  });
});

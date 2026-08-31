import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/settings/preferences", () => ({
  usePreferencesStore: {
    getState: () => ({ terminalCopyOnSelection: true }),
  },
}));

import { installCanvasTerminalSelectionCopy } from "./canvasTerminalSelectionCopy";

describe("installCanvasTerminalSelectionCopy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces selection changes, copies once, and expires the badge", async () => {
    let selection = "first";
    let onSelectionChange: (() => void) | undefined;
    const terminal = {
      getSelection: () => selection,
      clearSelection: vi.fn(),
      onSelectionChange: (listener: () => void) => {
        onSelectionChange = listener;
      },
    };
    const copyText = vi.fn(() => Promise.resolve());
    const onCopyBadgeChange = vi.fn();
    const dispose = installCanvasTerminalSelectionCopy(
      terminal,
      copyText,
      onCopyBadgeChange,
    );

    onSelectionChange?.();
    selection = "second";
    onSelectionChange?.();
    vi.advanceTimersByTime(119);
    expect(copyText).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    await Promise.resolve();

    expect(copyText).toHaveBeenCalledWith("second");
    expect(terminal.clearSelection).toHaveBeenCalledOnce();
    expect(onCopyBadgeChange).toHaveBeenCalledWith(true);

    vi.advanceTimersByTime(1_200);
    expect(onCopyBadgeChange).toHaveBeenLastCalledWith(false);
    dispose();
  });
});

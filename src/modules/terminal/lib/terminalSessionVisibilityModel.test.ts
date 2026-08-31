import { describe, expect, it, vi } from "vitest";
import { createTerminalSession } from "./terminalSessionModel";
import { syncTerminalSessionVisibility } from "./terminalSessionVisibilityModel";

describe("terminalSessionVisibilityModel", () => {
  it("reacquires an unbound visible slot and focuses it when requested", () => {
    const session = createTerminalSession();
    session.container = {} as HTMLDivElement;
    const bindLeafToSlot = vi.fn((_, current) => {
      current.hasSlot = true;
    });
    const setSlotFocused = vi.fn();
    const focusSlot = vi.fn();

    syncTerminalSessionVisibility({
      leafId: 7,
      session,
      visible: true,
      focused: true,
      bindLeafToSlot,
      setSlotFocused,
      focusSlot,
    });

    expect(session.visibleNow).toBe(true);
    expect(session.focusedNow).toBe(true);
    expect(bindLeafToSlot).toHaveBeenCalledWith(7, session);
    expect(setSlotFocused).toHaveBeenCalledWith(7, true);
    expect(focusSlot).toHaveBeenCalledWith(7);
  });

  it("removes renderer focus when the session becomes hidden", () => {
    const session = createTerminalSession();
    const setSlotFocused = vi.fn();
    syncTerminalSessionVisibility({
      leafId: 7,
      session,
      visible: false,
      focused: true,
      bindLeafToSlot: vi.fn(),
      setSlotFocused,
      focusSlot: vi.fn(),
    });
    expect(setSlotFocused).toHaveBeenCalledWith(7, false);
  });
});

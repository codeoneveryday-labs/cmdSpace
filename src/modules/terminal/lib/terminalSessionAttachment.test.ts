import { describe, expect, it, vi } from "vitest";
import { createTerminalSession } from "./terminalSessionModel";
import {
  detachTerminalSession,
  unbindTerminalSessionFromSlot,
} from "./terminalSessionAttachment";

describe("terminalSessionAttachment", () => {
  it("captures released renderer state for later rebind", () => {
    const session = createTerminalSession();
    session.hasSlot = true;
    const releaseSlot = vi.fn(() => ({
      snapshot: "saved",
      cols: 120,
      rows: 40,
      altScreen: true,
    }));

    unbindTerminalSessionFromSlot(7, session, releaseSlot);

    expect(session).toMatchObject({
      hasSlot: false,
      snapshot: "saved",
      cols: 120,
      rows: 40,
      altScreenAtRelease: true,
      shellState: null,
    });
  });

  it("detaches the session and clears live surface references", () => {
    const session = createTerminalSession();
    session.hasSlot = true;
    session.visibleNow = true;
    session.focusedNow = true;
    session.container = {} as HTMLDivElement;
    session.callbacks = { onExit: vi.fn() };

    detachTerminalSession({
      leafId: 7,
      session,
      releaseSlot: () => null,
    });

    expect(session.visibleNow).toBe(false);
    expect(session.focusedNow).toBe(false);
    expect(session.container).toBeNull();
    expect(session.callbacks).toEqual({});
  });
});

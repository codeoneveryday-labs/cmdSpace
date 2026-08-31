import { describe, expect, it, vi } from "vitest";
import { createTerminalSession } from "./terminalSessionModel";
import { clearTerminalSessionTimers } from "./terminalSessionTimers";

describe("terminalSessionTimers", () => {
  it("clears and resets all activity timers", () => {
    const session = createTerminalSession();
    session.initialCommandFallbackTimer = 11;
    session.agentActivityTimer = 22;
    session.outputActivityTimer = 33;
    const clearTimeout = vi.fn();

    clearTerminalSessionTimers(session, clearTimeout);

    expect(clearTimeout).toHaveBeenCalledWith(11);
    expect(clearTimeout).toHaveBeenCalledWith(22);
    expect(clearTimeout).toHaveBeenCalledWith(33);
    expect(session.initialCommandFallbackTimer).toBeNull();
    expect(session.agentActivityTimer).toBeNull();
    expect(session.outputActivityTimer).toBeNull();
  });
});

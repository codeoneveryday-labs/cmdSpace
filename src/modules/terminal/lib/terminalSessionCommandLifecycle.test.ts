import { describe, expect, it, vi } from "vitest";
import { createTerminalSession } from "./terminalSessionModel";
import { flushInitialCommand } from "./terminalSessionCommandLifecycle";

describe("terminalSessionCommandLifecycle", () => {
  it("writes the initial command with carriage return and publishes metadata", () => {
    const session = createTerminalSession("/repo", "echo hello");
    const write = vi.fn();
    const setMetadata = vi.fn(() => Promise.resolve());
    const onCommand = vi.fn();
    session.pty = { write, setMetadata } as never;
    session.callbacks = { onCommand };

    flushInitialCommand(7, session);

    expect(write).toHaveBeenCalledWith("echo hello\r");
    expect(setMetadata).toHaveBeenCalledWith({ agent: "echo hello" });
    expect(onCommand).toHaveBeenCalledWith("echo hello");
    expect(session.initialCommand).toBeUndefined();
  });

  it("handles initial command flush followed by subsequent prompt completion", () => {
    const session = createTerminalSession("/repo", "codex resume 'session-123'");
    expect(session.interactiveCodingAgent).toBe(true);

    const write = vi.fn();
    const setMetadata = vi.fn(() => Promise.resolve());
    const onCommand = vi.fn();
    session.pty = { write, setMetadata } as never;
    session.callbacks = { onCommand };

    // Initial prompt flushes command
    flushInitialCommand(7, session);
    expect(write).toHaveBeenCalledWith("codex resume 'session-123'\r");
    expect(session.initialCommand).toBeUndefined();
    expect(onCommand).toHaveBeenCalledWith("codex resume 'session-123'");
  });
});

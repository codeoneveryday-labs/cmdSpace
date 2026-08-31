import { describe, expect, it } from "vitest";
import { createTerminalSession } from "./terminalSessionModel";

describe("terminalSessionModel", () => {
  it("initializes a shell session with safe empty runtime state", () => {
    const session = createTerminalSession("/repo", "codex");

    expect(session).toMatchObject({
      initialCwd: "/repo",
      initialCommand: "codex",
      launchCommand: "codex",
      interactiveCodingAgent: true,
      visibleNow: false,
      focusedNow: false,
      hasSlot: false,
      pty: null,
    });
    expect(session.ready).toBeInstanceOf(Promise);
    expect(session.dormantRing).toBeDefined();
  });

  it("does not classify an ordinary shell command as an interactive agent", () => {
    expect(createTerminalSession(undefined, "echo hello").interactiveCodingAgent).toBe(false);
  });
});

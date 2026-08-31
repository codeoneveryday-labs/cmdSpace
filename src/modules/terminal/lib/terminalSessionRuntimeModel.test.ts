import { describe, expect, it } from "vitest";
import { createTerminalSession } from "./terminalSessionModel";
import {
  prepareTerminalSessionRespawn,
  resolveTerminalExitDisposition,
} from "./terminalSessionRuntimeModel";

describe("terminalSessionRuntimeModel", () => {
  it("preserves the launch command only when relaunch is requested", () => {
    const session = createTerminalSession("/old", "codex");
    session.snapshot = "old output";
    session.pendingExit = 1;
    session.inputBuffer = "draft";

    prepareTerminalSessionRespawn(session, "/new", true);

    expect(session).toMatchObject({
      initialCwd: "/new",
      initialCommand: "codex",
      respawning: true,
      snapshot: null,
      pendingExit: null,
      shellExited: false,
      inputBuffer: "",
      altScreenAtRelease: false,
    });
    expect(session.dormantRing).toBeDefined();
  });

  it("clears the initial command when the respawn is shell-only", () => {
    const session = createTerminalSession("/repo", "codex");
    prepareTerminalSessionRespawn(session, undefined, false);
    expect(session.initialCommand).toBeUndefined();
  });

  it("suppresses the expected old-process exit during respawn while preserving normal exit delivery", () => {
    expect(resolveTerminalExitDisposition(true, true)).toBe("suppress");
    expect(resolveTerminalExitDisposition(false, true)).toBe("notify");
    expect(resolveTerminalExitDisposition(false, false)).toBe("defer");
  });
});

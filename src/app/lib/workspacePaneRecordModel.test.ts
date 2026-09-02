import { describe, expect, it } from "vitest";
import { buildWorkspacePaneRecord } from "./workspacePaneRecordModel";

describe("workspacePaneRecordModel", () => {
  it("disables auto-launch when no command is present", () => {
    expect(buildWorkspacePaneRecord("w", 0, "/repo", null, false)).toMatchObject({
      autoLaunch: false,
      lastCommand: null,
      nativeSessionId: null,
    });
  });

  it("does not erase a persisted launch command from a stale empty callback", () => {
    expect(
      buildWorkspacePaneRecord("w", 2, "/repo", null, false, {
        paneIndex: 2,
        workingFolder: "/repo",
        lastCommand: "gemini",
        autoLaunch: true,
        agentProvider: "gemini",
        nativeSessionId: null,
      }),
    ).toMatchObject({
      lastCommand: "gemini",
      autoLaunch: true,
      agentProvider: "gemini",
    });
  });

  it("clears a launch command when the caller explicitly requests it", () => {
    expect(
      buildWorkspacePaneRecord("w", 2, "/repo", null, false, {
        paneIndex: 2,
        workingFolder: "/repo",
        lastCommand: "gemini",
        autoLaunch: true,
        agentProvider: "gemini",
        nativeSessionId: null,
      },
      null,
      "clear"),
    ).toMatchObject({
      lastCommand: null,
      autoLaunch: false,
      nativeSessionId: null,
    });
  });

  it("preserves a matching native agent session", () => {
    expect(
      buildWorkspacePaneRecord("w", 1, "/repo", "codex", true, {
        paneIndex: 1,
        workingFolder: "/repo",
        lastCommand: "codex",
        autoLaunch: true,
        agentProvider: "codex",
        nativeSessionId: "session-1",
      }),
    ).toMatchObject({
      lastCommand: "codex",
      agentProvider: "codex",
      nativeSessionId: "session-1",
    });
  });

  it("does not attach a native session to an ordinary command", () => {
    expect(buildWorkspacePaneRecord("w", 0, "/repo", "pnpm test", true)).toMatchObject({
      lastCommand: "pnpm test",
      agentProvider: null,
      nativeSessionId: null,
    });
  });
});

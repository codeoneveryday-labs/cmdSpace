import { describe, expect, it } from "vitest";
import {
  buildSessionResumeCommand,
  formatRelativeActivity,
  regularTerminalCount,
  sessionsForWorkspace,
  type ImportableAgentSession,
} from "./importSessions";

describe("workspace session imports", () => {
  it("formats recent activity in compact relative units", () => {
    const now = 1_000_000_000;

    expect(formatRelativeActivity(now - 60_000, now)).toBe("1m ago");
    expect(formatRelativeActivity(now - 2 * 3_600_000, now)).toBe("2h ago");
    expect(formatRelativeActivity(now - 5 * 86_400_000, now)).toBe("5d ago");
  });

  it("leaves one regular terminal after one import and eight CLI agents", () => {
    expect(regularTerminalCount(10, 1, 8)).toBe(1);
  });

  it.each([
    ["claude", "abc-123", "claude --resume 'abc-123'"],
    ["codex", "abc-123", "codex resume 'abc-123'"],
    ["opencode", "ses_123", "opencode --session 'ses_123'"],
    ["pi", "/tmp/session's.jsonl", "pi --session '/tmp/session'\"'\"'s.jsonl'"],
  ] as const)("builds a safe %s resume command", (provider, id, expected) => {
    expect(buildSessionResumeCommand(provider, id)).toBe(expected);
  });

  it("puts sessions from the active workspace first without hiding other projects", () => {
    const sessions: ImportableAgentSession[] = [
      {
        provider: "codex",
        sessionId: "other",
        cwd: "/repo/other",
        title: "Other",
        lastActivityAt: 30,
        active: false,
      },
      {
        provider: "claude",
        sessionId: "current-old",
        cwd: "/repo/current/",
        title: "Current old",
        lastActivityAt: 10,
        active: false,
      },
      {
        provider: "codex",
        sessionId: "current-new",
        cwd: "/repo/current",
        title: "Current new",
        lastActivityAt: 20,
        active: false,
      },
    ];

    expect(
      sessionsForWorkspace(sessions, "/repo/current").map(
        (session) => session.sessionId,
      ),
    ).toEqual(["current-new", "current-old", "other"]);
  });
});

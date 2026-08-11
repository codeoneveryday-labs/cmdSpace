import { describe, expect, it } from "vitest";
import {
  buildSessionResumeCommand,
  filterImportableSessions,
  formatRelativeActivity,
  isSessionInWorkspace,
  regularTerminalCount,
  sessionProviderCounts,
  sessionsForEnabledProviders,
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
    ["gemini", "abc-123", "gemini --resume 'abc-123'"],
    ["opencode", "ses_123", "opencode --session 'ses_123'"],
    ["copilot", "abc-123", "copilot --resume='abc-123'"],
    ["cursor", "abc-123", "cursor-agent --resume 'abc-123'"],
    [
      "aider",
      "/repo/.aider.chat.history.md",
      "aider --restore-chat-history --chat-history-file '/repo/.aider.chat.history.md'",
    ],
    ["pi", "/tmp/session's.jsonl", "pi --session '/tmp/session'\"'\"'s.jsonl'"],
    ["amp", "T-123", "amp threads continue 'T-123'"],
    ["cline", "task-123", "cline --taskId 'task-123'"],
    [
      "goose",
      "session-123",
      "goose session --resume --session-id 'session-123'",
    ],
    ["qwen", "session-123", "qwen --resume 'session-123'"],
    ["kimi", "session-123", "kimi --session 'session-123'"],
    ["openhands", "session-123", "openhands --resume 'session-123'"],
    [
      "kiro",
      "session-123",
      "kiro-cli chat --resume-id 'session-123'",
    ],
    ["grok", "session-123", "grok --resume 'session-123'"],
    ["herdr", "work", "herdr session attach 'work'"],
    [
      "cmd",
      "/repo/session.jsonl",
      "cmd --session '/repo/session.jsonl'",
    ],
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

  it.each([
    ["C:/Users/me/repo/", "C:/Users/me/repo"],
    ["C:\\Users\\me\\repo\\", "C:\\Users\\me\\repo"],
  ])(
    "treats trailing Windows separators as the same workspace cwd (%s ~ %s)",
    (sessionCwd, workspaceCwd) => {
      const session: ImportableAgentSession = {
        provider: "codex",
        sessionId: "current",
        cwd: sessionCwd,
        title: "Current",
        lastActivityAt: 10,
        active: false,
      };

      expect(isSessionInWorkspace(session, workspaceCwd)).toBe(true);
      expect(
        sessionsForWorkspace(
          [
            {
              provider: "claude",
              sessionId: "other",
              cwd: "C:/Users/me/other",
              title: "Other",
              lastActivityAt: 20,
              active: false,
            },
            session,
          ],
          workspaceCwd,
        ).map((item) => item.sessionId),
      ).toEqual(["current", "other"]);
    },
  );

  it("filters sessions by CLI provider and search text", () => {
    const sessions: ImportableAgentSession[] = [
      {
        provider: "cmd",
        sessionId: "command-session",
        cwd: "/repo/current",
        title: "Fix terminal input",
        lastActivityAt: 30,
        active: false,
      },
      {
        provider: "codex",
        sessionId: "codex-session",
        cwd: "/repo/current",
        title: "Review release",
        lastActivityAt: 20,
        active: false,
      },
      {
        provider: "cmd",
        sessionId: "other-command-session",
        cwd: "/repo/other",
        title: "Other project",
        lastActivityAt: 10,
        active: false,
      },
    ];

    expect(
      filterImportableSessions(
        sessions,
        "/repo/current",
        "workspace",
        "cmd",
        "terminal",
      ).map((session) => session.sessionId),
    ).toEqual(["command-session"]);
  });

  it("includes only enabled providers in settings order, including zero counts", () => {
    const sessions = [
      { provider: "cmd" },
      { provider: "codex" },
      { provider: "cmd" },
      { provider: "claude" },
    ] as ImportableAgentSession[];

    const counts = sessionProviderCounts(sessions, ["codex", "amp", "cmd"]);

    expect(counts).toEqual([
      { provider: "codex", count: 1 },
      { provider: "amp", count: 0 },
      { provider: "cmd", count: 2 },
    ]);
  });

  it("hides sessions from CLI agents disabled in settings", () => {
    const sessions = [
      { provider: "codex", sessionId: "codex-1" },
      { provider: "amp", sessionId: "amp-1" },
      { provider: "cmd", sessionId: "cmd-1" },
    ] as ImportableAgentSession[];

    expect(
      sessionsForEnabledProviders(sessions, ["codex", "cmd"]).map(
        (session) => session.sessionId,
      ),
    ).toEqual(["codex-1", "cmd-1"]);
  });
});

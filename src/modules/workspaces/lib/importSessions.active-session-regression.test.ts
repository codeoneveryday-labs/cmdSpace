import { describe, expect, it } from "vitest";
import {
  assignSessionsToPanes,
  type ImportableAgentSession,
} from "./importSessions";

describe("workspace session assignment", () => {
  it("keeps every newly launched agent pane runnable when its native session is active", () => {
    const panes = [
      ...Array.from({ length: 4 }, (_, paneIndex) => ({
        paneIndex,
        workingFolder: "/repo",
        autoLaunch: true,
        lastCommand: "codex --dangerously-bypass-approvals-and-sandbox",
        agentProvider: "codex" as const,
        nativeSessionId: `codex-${paneIndex}`,
      })),
      ...Array.from({ length: 4 }, (_, offset) => ({
        paneIndex: offset + 4,
        workingFolder: "/repo",
        autoLaunch: true,
        lastCommand: "cmd --dangerously-skip-permissions",
        agentProvider: "cmd" as const,
        nativeSessionId: `command-code-${offset}`,
      })),
    ];
    const sessions: ImportableAgentSession[] = panes.map((pane) => ({
      provider: pane.agentProvider,
      sessionId: pane.nativeSessionId,
      cwd: "/repo",
      title: pane.nativeSessionId,
      lastActivityAt: 1,
      active: true,
    }));

    expect(assignSessionsToPanes(panes, sessions, "/repo")).toEqual(panes);
  });
});

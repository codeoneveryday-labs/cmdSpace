import { describe, expect, it } from "vitest";
import type { CliAgentDefinition } from "@/modules/terminal/lib/cliAgents";
import {
  agentCommandPlan,
  buildWorkspaceLaunchCommands,
  coerceTerminalCount,
  recentWorkspaceFolderLabel,
  resolveEffectiveAgentCommands,
  resolveFolderCommand,
} from "./workspaceSetupModel";

describe("workspaceSetupModel", () => {
  it("normalizes cd commands across home and relative paths", () => {
    expect(resolveFolderCommand("cd ~/project", "/Users/alice/app")).toBe(
      "/Users/alice/project",
    );
    expect(resolveFolderCommand("cd ../repo", "/Users/alice/app")).toBe(
      "/Users/alice/repo",
    );
  });

  it("normalizes recent labels and terminal counts", () => {
    expect(recentWorkspaceFolderLabel("/Users/alice/repo")).toBe("~/repo");
    expect(coerceTerminalCount(999)).toBe(1);
    expect(coerceTerminalCount(4)).toBe(4);
  });

  it("builds repeated configured and custom agent commands", () => {
    expect(
      agentCommandPlan(
        { codex: 2, custom: 1 },
        "aider --yes",
        { codex: "codex --full-auto" },
      ),
    ).toEqual(["codex --full-auto", "codex --full-auto", "aider --yes"]);
  });

  it("resolves command overrides and preserves imported-session order", () => {
    const agents: CliAgentDefinition[] = [
      { id: "codex", command: "codex", launch: "codex --full-auto" },
    ] as CliAgentDefinition[];
    expect(
      resolveEffectiveAgentCommands(agents, { codex: "  codex --safe" }, {}),
    ).toEqual({ codex: "codex --safe" });
    expect(
      buildWorkspaceLaunchCommands({
        agentCounts: { codex: 1 },
        customCommand: "",
        effectiveCommands: { codex: "codex --safe" },
        selectedImportSessions: [
          {
            provider: "codex",
            sessionId: "session-1",
            cwd: "/repo",
            title: "Existing",
            lastActivityAt: 1,
            active: false,
          },
        ],
        cliTerminalCapacity: 2,
        isolateAgentWorktrees: false,
        agentWorktreeGroup: "test-session",
      }),
    ).toEqual(["codex resume 'session-1'", "codex --safe"]);
  });
});

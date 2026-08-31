import { describe, expect, it } from "vitest";
import {
  deriveImportSessionDialogModel,
  importSessionKey,
} from "./importSessionDialogModel";
import type { ImportableAgentSession } from "./importSessions";

function session(
  overrides: Partial<ImportableAgentSession>,
): ImportableAgentSession {
  return {
    provider: "codex",
    sessionId: "session-1",
    cwd: "/workspace",
    title: "Session",
    lastActivityAt: 1,
    active: false,
    ...overrides,
  };
}

describe("importSessionDialogModel", () => {
  it("falls back to all providers when the chosen provider is no longer enabled", () => {
    const result = deriveImportSessionDialogModel({
      sessions: [
        session({ sessionId: "codex-1", provider: "codex", lastActivityAt: 4 }),
        session({ sessionId: "claude-1", provider: "claude", lastActivityAt: 3 }),
      ],
      enabledProviders: ["codex"],
      workspaceCwd: "/workspace",
      scope: "workspace",
      provider: "claude",
      query: "",
      selectedSessionKeys: new Set<string>(),
    });

    expect(result.provider).toBe("all");
    expect(result.providerOptions).toEqual([{ provider: "codex", count: 1 }]);
    expect(result.visibleSessions.map((item) => item.sessionId)).toEqual([
      "codex-1",
    ]);
  });

  it("keeps selected sessions limited to enabled session keys and pluralizes the label", () => {
    const selected = [
      session({ sessionId: "codex-1", provider: "codex", lastActivityAt: 4 }),
      session({ sessionId: "gemini-1", provider: "gemini", lastActivityAt: 3 }),
      session({ sessionId: "claude-1", provider: "claude", lastActivityAt: 2 }),
    ];

    const result = deriveImportSessionDialogModel({
      sessions: selected,
      enabledProviders: ["codex", "gemini"],
      workspaceCwd: "/workspace",
      scope: "all",
      provider: "all",
      query: "",
      selectedSessionKeys: new Set([
        importSessionKey(selected[0]),
        importSessionKey(selected[1]),
        importSessionKey(selected[2]),
      ]),
    });

    expect(result.selectedSessions.map((item) => item.sessionId)).toEqual([
      "codex-1",
      "gemini-1",
    ]);
    expect(result.selectedSessionLabel).toBe("sessions");
  });
});

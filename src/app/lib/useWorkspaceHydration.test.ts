import { describe, expect, it } from "vitest";
import { normalizeHydratedWorkspace } from "./useWorkspaceHydration";

describe("useWorkspaceHydration", () => {
  it("normalizes persisted records without restoring transient tab ownership", () => {
    const workspace = normalizeHydratedWorkspace(
      {
        id: "workspace-1",
        name: "Workspace",
        count: 2,
        workingFolder: "/repo",
        createdAt: 1,
        updatedAt: 2,
        displayOrder: 0,
        paneLayout: null,
        accentColor: null,
        workspaceMode: "agent",
        agentProvider: null,
        agentSessionId: null,
        agentProviders: ["codex"],
        agentSessionIds: ["session-1"],
        agentChatIds: ["chat-1"],
      } as never,
      0,
    );

    expect(workspace).toMatchObject({
      workspaceMode: "agent",
      accentColor: expect.any(String),
      tabId: null,
      canvasTabId: null,
      agentTabIds: [],
      agentProviders: ["codex"],
      agentSessionIds: ["session-1"],
    });
  });
});

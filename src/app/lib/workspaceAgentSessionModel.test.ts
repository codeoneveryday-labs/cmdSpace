import { describe, expect, it } from "vitest";
import {
  appendAgentWorkspaceTerminal,
  prepareAgentWorkspaceTerminal,
  updateWorkspaceAgentSessionIdentity,
} from "./workspaceAgentSessionModel";
import type { WorkspaceRecord } from "./useWorkspaceController";

const workspace = {
  id: "workspace-1",
  name: "Workspace",
  count: 1,
  accentColor: "#0088ff",
  createdAt: 1,
  updatedAt: 1,
  displayOrder: 0,
  paneLayout: null,
  tabId: 1,
  canvasTabId: null,
  agentProvider: "codex",
  agentSessionId: null,
  agentChatIds: ["chat-1", "chat-2"],
  agentTabIds: [10, 11],
  agentProviders: ["codex", "claude"],
  agentSessionIds: [null, null],
} as WorkspaceRecord;

describe("workspaceAgentSessionModel", () => {
  it("prepares the next agent terminal only for supported commands under the limit", () => {
    expect(prepareAgentWorkspaceTerminal(workspace, "pnpm test", 0)).toBeNull();
    expect(prepareAgentWorkspaceTerminal(workspace, "codex", 12)).toBeNull();
    expect(prepareAgentWorkspaceTerminal(workspace, "claude --resume", 1)).toEqual({
      provider: "claude",
      index: 2,
      chatId: "workspace-1:chat:2",
      title: "Workspace · 2",
      cwd: "",
    });
  });

  it("appends agent terminal metadata while preserving the primary tab", () => {
    const updated = appendAgentWorkspaceTerminal(
      workspace,
      12,
      "gemini",
      "chat-3",
      3,
      42,
    );

    expect(updated).toMatchObject({
      tabId: 1,
      agentTabIds: [10, 11, 12],
      agentProviders: ["codex", "claude", "gemini"],
      agentSessionIds: [null, null, null],
      agentChatIds: ["chat-1", "chat-2", "chat-3"],
      count: 3,
      updatedAt: 42,
    });
    expect(workspace.agentTabIds).toEqual([10, 11]);
  });

  it("updates the matching chat slot without mutating the workspace", () => {
    const updated = updateWorkspaceAgentSessionIdentity(
      workspace,
      11,
      "chat-2",
      "gemini",
      "session-2",
      42,
    );

    expect(updated).toMatchObject({
      agentSessionId: "session-2",
      agentProviders: ["codex", "gemini"],
      agentSessionIds: [null, "session-2"],
      updatedAt: 42,
    });
    expect(workspace.agentProviders).toEqual(["codex", "claude"]);
  });

  it("initializes the first session slot when no matching tab exists", () => {
    expect(
      updateWorkspaceAgentSessionIdentity(
        { ...workspace, agentChatIds: [], agentTabIds: [], agentSessionIds: [] },
        99,
        "unknown",
        "codex",
        "session-1",
        7,
      ).agentSessionIds,
    ).toEqual(["session-1"]);
  });
});

import { describe, expect, it } from "vitest";
import { appendForkedAgentTab } from "./workspaceForkModel";
import type { WorkspaceRecord } from "./useWorkspaceController";

const workspace = {
  id: "w",
  name: "Workspace",
  count: 1,
  accentColor: "#0088ff",
  createdAt: 1,
  updatedAt: 1,
  displayOrder: 0,
  paneLayout: null,
  tabId: 10,
  canvasTabId: null,
  agentProvider: null,
  agentSessionId: null,
  agentTabIds: [10],
  agentProviders: ["codex"],
  agentSessionIds: [null],
  agentChatIds: ["chat-1"],
} as WorkspaceRecord;

describe("workspaceForkModel", () => {
  it("appends fork metadata without mutating the source workspace", () => {
    const updated = appendForkedAgentTab(workspace, 11, "chat-2", "claude", 42);

    expect(updated).toMatchObject({
      tabId: 10,
      agentTabIds: [10, 11],
      agentProviders: ["codex", "claude"],
      agentSessionIds: [null, null],
      agentChatIds: ["chat-1", "chat-2"],
      count: 2,
      updatedAt: 42,
    });
    expect(workspace.agentTabIds).toEqual([10]);
  });
});

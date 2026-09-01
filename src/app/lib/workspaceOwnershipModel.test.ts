import { describe, expect, it } from "vitest";
import { clearTabOwnership } from "./workspaceOwnershipModel";
import type { WorkspaceRecord } from "./useWorkspaceController";

const workspace = (overrides: Partial<WorkspaceRecord> = {}) =>
  ({
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
    ...overrides,
  }) as WorkspaceRecord;

describe("workspaceOwnershipModel", () => {
  it("falls back to the next agent tab when the primary tab closes", () => {
    const [updated] = clearTabOwnership(
      [workspace({ agentTabIds: [10, 11], agentProviders: ["codex", "claude"] })],
      10,
    );
    expect(updated.tabId).toBe(11);
    expect(updated.agentTabIds).toEqual([11]);
  });

  it("clears regular and canvas ownership independently", () => {
    expect(clearTabOwnership([workspace()], 10)[0].tabId).toBeNull();
    expect(clearTabOwnership([workspace({ canvasTabId: 12 })], 12)[0].canvasTabId).toBeNull();
  });
});

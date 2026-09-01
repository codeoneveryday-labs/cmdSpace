import { describe, expect, it } from "vitest";
import { updateWorkspaceFromPaneTree } from "./workspaceRecordModel";
import type { WorkspaceRecord } from "./workspaceControllerTypes";

describe("workspaceRecordModel pane-tree projection", () => {
  it("updates pane count and serialized layout while preserving workspace fields", () => {
    const workspace = {
      id: "workspace-1",
      name: "Workspace",
      count: 1,
      accentColor: "#0088ff",
      workingFolder: "/repo",
      updatedAt: 10,
    } as unknown as WorkspaceRecord;
    const paneTree = {
      kind: "split",
      children: [{ kind: "leaf", id: 1 }, { kind: "leaf", id: 2 }],
    } as unknown as Parameters<typeof updateWorkspaceFromPaneTree>[1];

    const updated = updateWorkspaceFromPaneTree(workspace, paneTree, 20);

    expect(updated).toMatchObject({
      id: "workspace-1",
      name: "Workspace",
      count: 2,
      updatedAt: 20,
      paneLayout: JSON.stringify(paneTree),
    });
    expect(workspace.count).toBe(1);
  });
});

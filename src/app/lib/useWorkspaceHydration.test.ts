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
        workspaceMode: "canvas",
      } as never,
      0,
    );

    expect(workspace).toMatchObject({
      workspaceMode: "canvas",
      accentColor: expect.any(String),
      tabId: null,
      canvasTabId: null,
    });
  });

  it("restores persisted pinning and pane layout while defaulting legacy fields", () => {
    const workspace = normalizeHydratedWorkspace(
      {
        id: "workspace-legacy",
        name: "Legacy workspace",
        count: 1,
        workingFolder: "/repo",
        createdAt: 1,
        updatedAt: 2,
        displayOrder: 0,
        paneLayout: '{"kind":"leaf","size":100}',
        accentColor: null,
        workspaceMode: null,
        pinned: true,
      } as never,
      1,
    );

    expect(workspace).toMatchObject({
      pinned: true,
      paneLayout: '{"kind":"leaf","size":100}',
      workspaceMode: "standard",
      tabId: null,
      canvasTabId: null,
    });
  });
});

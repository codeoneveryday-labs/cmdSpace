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
    ...overrides,
  }) as WorkspaceRecord;

describe("workspaceOwnershipModel", () => {
  it("clears regular and canvas ownership independently", () => {
    expect(clearTabOwnership([workspace()], 10)[0].tabId).toBeNull();
    expect(clearTabOwnership([workspace({ canvasTabId: 12 })], 12)[0].canvasTabId).toBeNull();
  });
});

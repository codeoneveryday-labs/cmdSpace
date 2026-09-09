import { describe, expect, it } from "vitest";
import { selectWorkspaceDeletionFallback } from "./useWorkspaceDeletion";
import type { WorkspaceRecord } from "./useWorkspaceController";

function workspace(id: string): WorkspaceRecord {
  return {
    id,
    name: id,
    accentColor: "blue",
    count: 1,
    workingFolder: null,
    paneLayout: null,
    tabId: null,
    canvasTabId: null,
    workspaceMode: "canvas",
    createdAt: 0,
    updatedAt: 0,
    displayOrder: 0,
  };
}

describe("selectWorkspaceDeletionFallback", () => {
  it("prefers the most recently opened live workspace", () => {
    const fallback = selectWorkspaceDeletionFallback(
      [workspace("first"), workspace("recent"), workspace("other")],
      [{ id: "deleted" }, { id: "recent" }, { id: "other" }],
      "deleted",
    );

    expect(fallback?.id).toBe("recent");
  });

  it("ignores stale recent entries and falls back to the first live workspace", () => {
    const fallback = selectWorkspaceDeletionFallback(
      [workspace("first"), workspace("second")],
      [{ id: "deleted" }, { id: "missing" }],
      "deleted",
    );

    expect(fallback?.id).toBe("first");
  });

  it("returns no fallback when the deleted workspace was the last one", () => {
    expect(
      selectWorkspaceDeletionFallback([], [{ id: "deleted" }], "deleted"),
    ).toBeUndefined();
  });
});

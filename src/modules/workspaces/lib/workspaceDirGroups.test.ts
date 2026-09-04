import { describe, expect, it } from "vitest";
import {
  buildWorkspaceGroupMoveSteps,
  groupWorkspacesByDir,
  type WorkspaceDirGroup,
} from "./workspaceDirGroups";
import type { WorkspaceItem } from "../WorkspacesPanel";

function item(
  id: string,
  name: string,
  workingFolder: string,
): WorkspaceItem {
  return {
    id,
    name,
    count: 1,
    accentColor: "#fff",
    workingFolder,
  };
}

describe("workspaceDirGroups", () => {
  it("groups workspaces sharing a directory under the dir basename", () => {
    const groups: WorkspaceDirGroup[] = groupWorkspacesByDir([
      item("a", "Agent design", "/Users/dev/bridgemind"),
      item("b", "Review swift", "/Users/dev/bridgemind"),
      item("c", "Grok Build", "/Users/dev/other"),
    ]);

    expect(groups.map((group) => group.label)).toEqual([
      "bridgemind",
      "other",
    ]);
    expect(groups[0]?.workspaces.map((entry) => entry.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("keeps workspaces without a folder under a root group", () => {
    const groups = groupWorkspacesByDir([
      item("a", "Floating", ""),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.workspaces.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("keeps directory groups in workspace order for persistence-backed reordering", () => {
    const groups = groupWorkspacesByDir([
      item("other", "Other", "/Users/dev/other"),
      item("bridge", "Bridge", "/Users/dev/bridgemind"),
    ]);

    expect(groups.map((group) => group.label)).toEqual(["other", "bridgemind"]);
  });

  it("moves every workspace in a directory as one ordered block", () => {
    const workspaces = [
      item("a1", "A1", "/Users/dev/a"),
      item("a2", "A2", "/Users/dev/a"),
      item("b1", "B1", "/Users/dev/b"),
    ];

    expect(
      buildWorkspaceGroupMoveSteps(workspaces, "/Users/dev/a", "/Users/dev/b", "after"),
    ).toEqual([
      { draggedId: "a1", targetId: "b1", position: "after" },
      { draggedId: "a2", targetId: "a1", position: "after" },
    ]);
  });

  it("preserves workspace order when moving a lower directory above another", () => {
    const workspaces = [
      item("b1", "B1", "/Users/dev/b"),
      item("b2", "B2", "/Users/dev/b"),
      item("a1", "A1", "/Users/dev/a"),
      item("a2", "A2", "/Users/dev/a"),
    ];

    expect(
      buildWorkspaceGroupMoveSteps(workspaces, "/Users/dev/a", "/Users/dev/b", "before"),
    ).toEqual([
      { draggedId: "a2", targetId: "b1", position: "before" },
      { draggedId: "a1", targetId: "b1", position: "before" },
    ]);
  });

  it("does not emit reorder steps when the group is already on the requested side", () => {
    const workspaces = [
      item("a", "A", "/Users/dev/a"),
      item("b", "B", "/Users/dev/b"),
    ];

    expect(buildWorkspaceGroupMoveSteps(workspaces, "/Users/dev/a", "/Users/dev/b", "before")).toEqual([]);
    expect(buildWorkspaceGroupMoveSteps(workspaces, "/Users/dev/b", "/Users/dev/a", "after")).toEqual([]);
  });
});

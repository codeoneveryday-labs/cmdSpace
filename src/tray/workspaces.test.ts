import { describe, expect, it } from "vitest";
import {
  clampSelectionIndex,
  filterTrayWorkspaces,
  groupTrayWorkspacesByDir,
  type TrayWorkspace,
} from "./workspaces";

const workspaces: TrayWorkspace[] = [
  {
    id: "standard",
    name: "API server",
    count: 4,
    accentColor: "#10B981",
    workingFolder: "/Users/dev/projects/api",
    workspaceMode: "standard",
  },
  {
    id: "canvas",
    name: "Architecture map",
    count: 8,
    accentColor: "#8B5CF6",
    workingFolder: "/Users/dev/projects/platform",
    workspaceMode: "canvas",
  },
];

describe("menu bar workspace helpers", () => {
  it("matches workspace names and folders case-insensitively", () => {
    expect(filterTrayWorkspaces(workspaces, "SERVER")).toEqual([workspaces[0]]);
    expect(filterTrayWorkspaces(workspaces, "PLATFORM")).toEqual([workspaces[1]]);
    expect(filterTrayWorkspaces(workspaces, "  ")).toEqual(workspaces);
  });

  it("keeps keyboard selection inside the visible result list", () => {
    expect(clampSelectionIndex(-1, 2)).toBe(0);
    expect(clampSelectionIndex(4, 2)).toBe(1);
    expect(clampSelectionIndex(0, 0)).toBe(-1);
  });

  it("groups workspaces sharing a parent dir under the dir basename", () => {
    const grouped = groupTrayWorkspacesByDir([
      ...workspaces,
      {
        id: "second-api",
        name: "Worker",
        count: 2,
        workingFolder: "/Users/dev/projects/api",
        workspaceMode: "standard",
      },
    ]);

    expect(grouped.map((group) => group.label)).toEqual(["api", "platform"]);
    expect(grouped[0]?.workspaces.map((item) => item.id)).toEqual([
      "standard",
      "second-api",
    ]);
  });
});

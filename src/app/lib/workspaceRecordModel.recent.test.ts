import { describe, expect, it } from "vitest";
import { buildRecentWorkspaceItem } from "./workspaceRecordModel";

describe("workspaceRecordModel recent projection", () => {
  it("projects only workspaces with a working folder", () => {
    expect(
      buildRecentWorkspaceItem({
        id: "workspace-1",
        name: "Docs",
        count: 2,
        accentColor: "#0088ff",
        workingFolder: "/repo",
      }, 123),
    ).toEqual({
      id: "workspace-1",
      name: "Docs",
      count: 2,
      accentColor: "#0088ff",
      workingFolder: "/repo",
      updatedAt: 123,
    });
    expect(
      buildRecentWorkspaceItem({
        id: "workspace-2",
        name: "Empty",
        count: 0,
        accentColor: "#fff",
        workingFolder: null,
      }),
    ).toBeNull();
  });
});

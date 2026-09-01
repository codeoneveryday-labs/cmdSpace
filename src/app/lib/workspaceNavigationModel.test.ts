import { describe, expect, it } from "vitest";
import { nextWorkspaceIndex } from "./workspaceNavigationModel";

describe("workspaceNavigationModel", () => {
  it("wraps next and previous workspace selection", () => {
    expect(nextWorkspaceIndex(3, 2, 1)).toBe(0);
    expect(nextWorkspaceIndex(3, 0, -1)).toBe(2);
  });

  it("chooses an edge when the active workspace is missing", () => {
    expect(nextWorkspaceIndex(3, -1, 1)).toBe(0);
    expect(nextWorkspaceIndex(3, -1, -1)).toBe(2);
  });

  it("does not navigate when there is only one workspace", () => {
    expect(nextWorkspaceIndex(1, 0, 1)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  reorderWorkspaceRecords,
  uniqueWorkspaceName,
} from "./workspaceRecordModel";
import type { WorkspaceRecord } from "./useWorkspaceController";

const workspace = (id: string, name: string, displayOrder: number) =>
  ({ id, name, displayOrder }) as unknown as WorkspaceRecord;

describe("workspaceRecordModel", () => {
  it("adds the first available case-insensitive name suffix", () => {
    const workspaces = [
      workspace("a", "Docs", 0),
      workspace("b", "Docs (1)", 1),
    ];
    expect(uniqueWorkspaceName(workspaces, "c", " docs ")).toBe("docs (2)");
    expect(uniqueWorkspaceName(workspaces, "a", "Docs")).toBe("Docs");
    expect(uniqueWorkspaceName(workspaces, "c", "   ")).toBeNull();
  });

  it("reorders records and rewrites display order", () => {
    const workspaces = [
      workspace("a", "A", 0),
      workspace("b", "B", 1),
      workspace("c", "C", 2),
    ];
    expect(reorderWorkspaceRecords(workspaces, "a", "c", "after")?.map((item) => item.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(reorderWorkspaceRecords(workspaces, "a", "missing", "before")).toBeNull();
    expect(reorderWorkspaceRecords(workspaces, "c", "a", "before")?.map((item) => item.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(workspaces.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});

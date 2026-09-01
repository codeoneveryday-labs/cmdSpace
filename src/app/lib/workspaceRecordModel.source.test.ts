import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./workspaceRecordModel.ts", import.meta.url),
  "utf8",
);

describe("workspaceRecordModel contract", () => {
  it("centralizes unique-name and display-order transitions", () => {
    expect(source).toContain("uniqueWorkspaceName");
    expect(source).toContain("reorderWorkspaceRecords");
    expect(source).toContain("buildRecentWorkspaceItem");
    expect(source).toContain("updateWorkspaceFromPaneTree");
    expect(source).toContain("displayOrder");
    expect(source).toContain("(${suffix})");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceAgentAssignmentSummary.tsx", import.meta.url),
  "utf8",
);

describe("WorkspaceAgentAssignmentSummary contract", () => {
  it("keeps assignment, worktree and import-session controls together", () => {
    expect(source).toContain("export function WorkspaceAgentAssignmentSummary");
    expect(source).toContain("Isolate agent changes in Git worktrees");
    expect(source).toContain("Import existing session");
    expect(source).toContain("setSelectedImportSessions");
    expect(source).not.toContain("invoke(");
  });
});

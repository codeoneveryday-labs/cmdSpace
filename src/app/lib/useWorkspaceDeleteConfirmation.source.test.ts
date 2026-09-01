import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceDeleteConfirmation.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceDeleteConfirmation contract", () => {
  it("keeps skip-confirm preference and pending confirmation transitions controlled", () => {
    expect(source).toContain("useWorkspaceDeleteConfirmation");
    expect(source).toContain("skipConfirmation");
    expect(source).toContain("workspacesRef.current.length <= 1");
    expect(source).toContain("setPendingWorkspaceId(workspaceId)");
    expect(source).toContain("WORKSPACE_DELETE_CONFIRM_STORAGE_KEY");
    expect(source).toContain("localStorage.setItem");
    expect(source).toContain("confirmDeleteWorkspace");
    expect(source).toContain("cancelDeleteWorkspace");
  });
});

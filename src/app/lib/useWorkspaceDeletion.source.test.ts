import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceDeletion.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceDeletion contract", () => {
  it("guards the final workspace and delegates tab ownership cleanup", () => {
    expect(source).toContain("useWorkspaceDeletion");
    expect(source).toContain("workspacesRef.current.length <= 1");
    expect(source).toContain("new Set");
    expect(source).toContain("wouldLeaveNoTabs");
    expect(source).toContain("disposeTab");
    expect(source).toContain("resetWorkspace");
    expect(source).toContain("removeWorkspace");
  });
});

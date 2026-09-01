import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./workspaceOwnershipModel.ts", import.meta.url), "utf8");

describe("workspaceOwnershipModel contract", () => {
  it("keeps tab ownership cleanup immutable and side-effect free", () => {
    expect(source).toContain("clearTabOwnership");
    expect(source).toContain("agentTabIds");
    expect(source).toContain("canvasTabId");
    expect(source).not.toContain("setWorkspaces");
    expect(source).not.toContain("invoke(");
  });
});

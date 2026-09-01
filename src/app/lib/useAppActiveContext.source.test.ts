import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppActiveContext.ts", import.meta.url),
  "utf8",
);

describe("useAppActiveContext contract", () => {
  it("resolves active workspace ownership and surface-kind predicates", () => {
    expect(source).toContain("useAppActiveContext");
    expect(source).toContain("workspace.tabId === activeId");
    expect(source).toContain("workspace.canvasTabId === activeId");
    expect(source).toContain("workspace.agentTabIds?.includes(activeId)");
    expect(source).toContain("activeWorkspaceId");
    expect(source).toContain("isTerminalTab");
    expect(source).toContain("isGitDiffTab");
    expect(source).toContain("isArchitectureTab");
  });
});

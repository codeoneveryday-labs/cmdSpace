import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppWorkspaceTerminalView.ts", import.meta.url),
  "utf8",
);

describe("useAppWorkspaceTerminalView contract", () => {
  it("derives live terminal rows and coding-agent count from one view seam", () => {
    expect(source).toContain("useAppWorkspaceTerminalView");
    expect(source).toContain("buildActiveTerminalItems");
    expect(source).toContain("countActiveCodingAgents");
    expect(source).toContain("activeWorkspaceTerminals");
    expect(source).toContain("activeWorkspaceCodingAgentCount");
  });
});

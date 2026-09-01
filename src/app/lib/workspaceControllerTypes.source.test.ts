import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./workspaceControllerTypes.ts", import.meta.url),
  "utf8",
);

describe("workspaceControllerTypes contract", () => {
  it("defines the controller record and feature port contracts", () => {
    expect(source).toContain("WorkspaceRecord");
    expect(source).toContain("CreateWorkspaceInput");
    expect(source).toContain("CreateWorkspaceTerminalInput");
    expect(source).toContain("ImportAgentSessionInput");
    expect(source).toContain("DeleteWorkspaceInput");
  });
});

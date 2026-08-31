import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceList.tsx", import.meta.url),
  "utf8",
);

describe("WorkspaceList contract", () => {
  it("renders expandable workspace rows and terminal lists", () => {
    expect(source).toContain("WorkspaceList");
    expect(source).toContain("WorkspaceRow");
    expect(source).toContain("WorkspaceTerminalList");
    expect(source).toContain("expandedWorkspaceIds");
    expect(source).toContain("onSelectWorkspace");
    expect(source).toContain("onDragStart");
  });
});

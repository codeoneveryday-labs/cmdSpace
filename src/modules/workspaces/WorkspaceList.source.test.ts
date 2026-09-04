import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceList.tsx", import.meta.url),
  "utf8",
);

describe("WorkspaceList contract", () => {
  it("renders directory groups without terminal rows", () => {
    expect(source).toContain("WorkspaceList");
    expect(source).toContain("WorkspaceRow");
    expect(source).toContain("groupWorkspacesByDir");
    expect(source).toContain("DragDropVerticalIcon");
    expect(source).toContain("onGroupDragStart");
    expect(source).toContain("data-workspace-group-id");
    expect(source).toContain("groupCount");
    expect(source).toContain("aria-expanded={groupExpanded}");
    expect(source).toContain("onSelectWorkspace");
    expect(source).toContain("onDragStart");
    expect(source).not.toContain("WorkspaceTerminalList");
    expect(source).not.toContain("expandedWorkspaceIds");
    expect(source).not.toContain("onSelectTerminal");
    expect(source).not.toContain("onCreateTerminal");
    expect(source).not.toContain("terminalDragVisual");
  });
});

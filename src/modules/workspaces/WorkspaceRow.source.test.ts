import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceRow.tsx", import.meta.url),
  "utf8",
);

describe("WorkspaceRow contract", () => {
  it("preserves workspace actions without terminal expansion", () => {
    expect(source).toContain("export function WorkspaceRow");
    expect(source).toContain("commitRename");
    expect(source).toContain("WorkspaceColorPicker");
    expect(source).toContain("getWorkspaceCliAgent");
    expect(source).toContain("AgentCliIcon");
    expect(source).toContain("onClose");
    expect(source).toContain("onDragStart");
    expect(source).not.toContain("onToggleExpanded");
    expect(source).not.toContain("expanded");
  });
});

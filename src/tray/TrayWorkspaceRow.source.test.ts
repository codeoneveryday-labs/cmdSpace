import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "TrayWorkspaceRow.tsx",
);

describe("TrayWorkspaceRow", () => {
  it("owns workspace row presentation and terminal expansion interactions", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("workspace.workspaceMode === \"canvas\"");
    expect(source).toContain("onToggleExpanded");
    expect(source).toContain("onOpen");
    expect(source).toContain("No terminals open");
    expect(source).toContain('role="option"');
  });
});

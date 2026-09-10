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
    expect(source).toContain("min-w-0 flex-1 truncate");
    expect(source).toContain("title={terminal.label}");
    expect(source).toContain("getWorkspaceModeIcon");
    expect(source).toContain("borderColor: workspace.accentColor");
    expect(source).toContain("onOpenTerminal(terminal, paneIndex)");
    expect(source).toContain("h-8 min-h-8");
    expect(source).toContain("size-6 shrink-0");
    expect(source).not.toContain("border-l border-border/60");
    expect(source).not.toContain("color: workspace.accentColor");
  });
});

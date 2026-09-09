import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceRow.tsx", import.meta.url),
  "utf8",
);

describe("WorkspaceRow contract", () => {
  it("opens a rename dialog from the workspace action menu", () => {
    expect(source).toContain("export function WorkspaceRow");
    expect(source).toContain("DropdownMenu");
    expect(source).toContain("MoreHorizontalIcon");
    expect(source).toContain("onSelect={() => setRenameDialogOpen(true)}");
    expect(source).toContain('className="w-36 min-w-0 rounded-lg p-1"');
    expect(source).toContain("Rename Workspace");
    expect(source).toContain(
      "Only the display name changes. The actual folder path will stay the same.",
    );
    expect(source).toContain("Confirm");
    expect(source).toContain("DialogContent");
    expect(source.match(/\{renameDialog\}/g)).toHaveLength(2);
    expect(source).toContain("WorkspaceColorPicker");
    expect(source).toContain("getWorkspaceCliAgent");
    expect(source).toContain("AgentCliIcon");
    expect(source).toContain("onClose");
    expect(source).toContain("onDragStart");
    expect(source).not.toContain("onToggleExpanded");
    expect(source).not.toContain("expanded");
  });
});

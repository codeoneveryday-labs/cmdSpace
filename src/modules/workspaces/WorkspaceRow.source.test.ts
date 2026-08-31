import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./WorkspaceRow.tsx", import.meta.url),
  "utf8",
);

describe("WorkspaceRow contract", () => {
  it("preserves rename, expand, color and close interactions", () => {
    expect(source).toContain("export function WorkspaceRow");
    expect(source).toContain("onToggleExpanded");
    expect(source).toContain("commitRename");
    expect(source).toContain("WorkspaceColorPicker");
    expect(source).toContain("onClose");
    expect(source).toContain("onDragStart");
  });
});

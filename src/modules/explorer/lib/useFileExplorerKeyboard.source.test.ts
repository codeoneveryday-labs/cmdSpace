import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useFileExplorerKeyboard.ts", import.meta.url),
  "utf8",
);

describe("useFileExplorerKeyboard contract", () => {
  it("owns undo, navigation, selection, toggle and open routing", () => {
    expect(source).toContain("resolveExplorerNavigation");
    expect(source).toContain("onUndoDelete");
    expect(source).toContain("onDeleteSelected");
    expect(source).toContain("tree.toggle(action.path)");
    expect(source).toContain("onOpenFile(action.path)");
  });
});

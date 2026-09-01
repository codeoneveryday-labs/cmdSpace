import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./appShortcutCoordination.ts", import.meta.url),
  "utf8",
);

describe("appShortcutCoordination contract", () => {
  it("keeps global shortcut mapping and context guards in one focused module", () => {
    expect(source).toContain("createAppShortcutHandlers");
    expect(source).toContain("createAppShortcutDisabled");
    expect(source).toContain('"tab.newPrivate"');
    expect(source).toContain('"pane.focusLeft"');
    expect(source).toContain('"editor.undo"');
    expect(source).toContain('activeTabKind !== "terminal"');
    expect(source).toContain("isExplorerFocused");
    expect(source).toContain("architectureActive");
  });
});

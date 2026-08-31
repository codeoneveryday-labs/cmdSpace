import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useBottomTerminalTabDrag.ts", import.meta.url),
  "utf8",
);

describe("useBottomTerminalTabDrag contract", () => {
  it("owns pointer threshold, hit testing, focus and reorder cleanup", () => {
    expect(source).toContain("elementFromPoint");
    expect(source).toContain("data-bottom-terminal-tab");
    expect(source).toContain("focusTab(drag.id)");
    expect(source).toContain("reorderTabs(");
    expect(source).toContain('window.addEventListener("pointercancel"');
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useTabBarDrag.ts", import.meta.url),
  "utf8",
);

describe("useTabBarDrag contract", () => {
  it("owns pointer threshold, preview placement, reorder and click selection", () => {
    expect(source).toContain("previewIndexForPointer");
    expect(source).toContain('window.addEventListener("pointermove"');
    expect(source).toContain('window.addEventListener("pointercancel"');
    expect(source).toContain('"after" : "before"');
    expect(source).toContain("onSelect(drag.id)");
  });
});

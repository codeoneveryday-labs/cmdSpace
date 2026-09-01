import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./tabPaneClose.ts", import.meta.url), "utf8");

describe("tabPaneClose contract", () => {
  it("owns sibling fallback and maximize cleanup", () => {
    expect(source).toContain("closePaneFromTerminalTab");
    expect(source).toContain("closeTerminalPaneState");
    expect(source).toContain("siblingLeafOf");
    expect(source).toContain("replacementActiveId");
    expect(source).toContain("maximizedLeafId");
    expect(source).toContain("removed: true");
  });
});

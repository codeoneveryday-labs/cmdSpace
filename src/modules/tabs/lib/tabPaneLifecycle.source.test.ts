import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./tabPaneLifecycle.ts", import.meta.url), "utf8");

describe("tabPaneLifecycle contract", () => {
  it("owns split/append pane limits and active-leaf updates", () => {
    expect(source).toContain("splitTerminalPane");
    expect(source).toContain("appendTerminalPane");
    expect(source).toContain("MAX_PANES_PER_TAB");
    expect(source).toContain("maximizedLeafId: undefined");
  });
});

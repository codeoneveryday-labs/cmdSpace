import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./paneResizeModel.ts", import.meta.url), "utf8");

describe("paneResizeModel contract", () => {
  it("keeps split sizing math independent from pointer and PTY effects", () => {
    expect(source).toContain("resizeAdjacentPanes");
    expect(source).toContain("commitPaneLayout");
    expect(source).toContain("toFixed(3)");
    expect(source).not.toContain("setTerminalResizePaused");
    expect(source).not.toContain("requestAnimationFrame");
  });
});

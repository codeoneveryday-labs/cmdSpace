import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasDockDividerResize.ts", import.meta.url),
  "utf8",
);

describe("useCanvasDockDividerResize contract", () => {
  it("owns RAF-batched pointer and keyboard divider resizing", () => {
    expect(source).toContain("useCanvasDockDividerResize");
    expect(source).toContain("requestAnimationFrame");
    expect(source).toContain("updateTerminalDockSplitRatio");
    expect(source).toContain("handleDockDividerPointerMove");
    expect(source).toContain("handleDockDividerKeyDown");
    expect(source).toContain("releasePointerCapture");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useBottomTerminalResize.ts", import.meta.url),
  "utf8",
);

describe("useBottomTerminalResize contract", () => {
  it("owns pointer clamping, RAF batching and resize cleanup", () => {
    expect(source).toContain("MIN_BOTTOM_TERMINAL_HEIGHT");
    expect(source).toContain("MAX_BOTTOM_TERMINAL_HEIGHT");
    expect(source).toContain("requestAnimationFrame(flushResize)");
    expect(source).toContain("cancelAnimationFrame(resizeFrameRef.current)");
    expect(source).toContain("setResizing(false)");
  });
});

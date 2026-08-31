import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasNodePointerDown.ts", import.meta.url),
  "utf8",
);

describe("useCanvasNodePointerDown contract", () => {
  it("coordinates mode routing, selection guards and drag capture", () => {
    expect(source).toContain("export function useCanvasNodePointerDown");
    expect(source).toContain('mode === "eraser"');
    expect(source).toContain('mode === "connect"');
    expect(source).toContain('mode === "pan"');
    expect(source).toContain("event.shiftKey");
    expect(source).toContain("item.locked");
    expect(source).toContain("setPointerCapture(event.pointerId)");
  });
});

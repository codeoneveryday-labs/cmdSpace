import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasDockDividerPointerDown.ts", import.meta.url),
  "utf8",
);

describe("useCanvasDockDividerPointerDown contract", () => {
  it("captures history, resets conflicting gestures and captures the pointer", () => {
    expect(source).toContain("export function useCanvasDockDividerPointerDown");
    expect(source).toContain("pushHistory();");
    expect(source).toContain("setDrag(null);");
    expect(source).toContain("clearShapeGestures();");
    expect(source).toContain("beginDockDividerResize(divider");
    expect(source).toContain("setPointerCapture(event.pointerId)");
  });
});

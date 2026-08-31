import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasPointerDown.ts", import.meta.url),
  "utf8",
);

describe("useCanvasPointerDown contract", () => {
  it("coordinates pan, placement, drawing and selection branches", () => {
    expect(source).toContain("export function useCanvasPointerDown");
    expect(source).toContain('mode === "pan"');
    expect(source).toContain("commitFreeSurfacePlacement");
    expect(source).toContain('mode === "terminal"');
    expect(source).toContain("isShapeDrawingMode(mode)");
    expect(source).toContain("beginDrawing(");
    expect(source).toContain("clearSelection();");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasPointerMove.ts", import.meta.url),
  "utf8",
);

describe("useCanvasPointerMove contract", () => {
  it("coordinates camera, shape gestures and all drag branches", () => {
    expect(source).toContain("export function useCanvasPointerMove");
    expect(source).toContain("panFromPointer(event)");
    expect(source).toContain("updateShapeGesture(event)");
    expect(source).toContain("resolveCanvasDragMove");
    expect(source).toContain('drag.terminalGroupId');
    expect(source).toContain("resolveLiveSurfaceDockTarget");
    expect(source).toContain("applyCanvasDragMove");
  });
});

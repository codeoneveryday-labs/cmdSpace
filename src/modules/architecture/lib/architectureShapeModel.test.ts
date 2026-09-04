import { describe, expect, it } from "vitest";
import {
  defaultSize,
  minimumDrawingSize,
  normalizeDragRect,
  normalizeResizeRect,
  normalizeRotation,
} from "./architectureShapeModel";

describe("architectureShapeModel", () => {
  it("keeps square drawing bounds and minimum size", () => {
    expect(
      normalizeDragRect(
        { x: 100, y: 100 },
        { x: 80, y: 130 },
        minimumDrawingSize("circle"),
        true,
      ),
    ).toEqual({ x: 68, y: 100, width: 32, height: 32 });
  });

  it("anchors west/north resize handles while respecting minimums", () => {
    expect(
      normalizeResizeRect(
        { id: "r", kind: "rectangle", x: 100, y: 100, width: 80, height: 60 } as never,
        "nw",
        { x: 170, y: 150 },
      ),
    ).toEqual({ x: 140, y: 128, width: 40, height: 32 });
  });

  it("normalizes rotation and preserves documented defaults", () => {
    expect(normalizeRotation(-90)).toBe(270);
    expect(defaultSize("terminal")).toEqual({ width: 640, height: 400 });
  });
});

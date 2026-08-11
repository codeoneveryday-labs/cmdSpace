import { describe, expect, it } from "vitest";

import {
  canvasPointFromClient,
  clampCanvasView,
  type CanvasView,
  centerCanvasView,
  zoomCanvasViewAtPoint,
} from "./useCanvasCamera";

const DEFAULT_VIEW: CanvasView = { x: 0, y: 0, scale: 1 };
const DEFAULT_CANVAS_SIZE = { width: 1200, height: 720 };

describe("useCanvasCamera helpers", () => {
  it("keeps wheel zoom anchored to the pointer position", () => {
    const nextView = zoomCanvasViewAtPoint(
      DEFAULT_VIEW,
      DEFAULT_CANVAS_SIZE,
      { x: 0.25, y: 0.75 },
      120,
    );

    expect(nextView.x).toBeCloseTo(-81.3747450964214);
    expect(nextView.y).toBeCloseTo(-146.47454117355858);
    expect(nextView.scale).toBeCloseTo(0.7866278610665534);
  });

  it("clamps free panning with the same zoom-aware margin on both axes", () => {
    const nextView = clampCanvasView(
      { x: -2000, y: 5000, scale: 1.2 },
      DEFAULT_CANVAS_SIZE,
    );

    expect(nextView.x).toBeCloseTo(-1636.363636363636);
    expect(nextView.y).toBeCloseTo(1101.8181818181818);
    expect(nextView.scale).toBe(1.2);
  });

  it("recenters the viewport while preserving the current center point", () => {
    const nextView = centerCanvasView(
      { x: 140, y: 80, scale: 1 },
      DEFAULT_CANVAS_SIZE,
      1.4,
    );

    expect(nextView.x).toBeCloseTo(311.4285714285714);
    expect(nextView.y).toBeCloseTo(182.85714285714283);
    expect(nextView.scale).toBe(1.4);
  });

  it("projects a client pointer into the current world-space viewport", () => {
    expect(
      canvasPointFromClient(
        { clientX: 300, clientY: 180 },
        {
          left: 100,
          top: 60,
          width: 800,
          height: 400,
        },
        { x: 200, y: -40, scale: 2 },
      ),
    ).toEqual({
      x: 300,
      y: 20,
    });
  });
});

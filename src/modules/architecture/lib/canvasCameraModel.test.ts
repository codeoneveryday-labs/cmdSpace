import { describe, expect, it } from "vitest";
import {
  canvasPointFromClient,
  clampCanvasView,
  wheelPanDelta,
  zoomCanvasViewAtPoint,
} from "./canvasCameraModel";

describe("canvasCameraModel", () => {
  it("maps client coordinates into the current view", () => {
    expect(
      canvasPointFromClient(
        { clientX: 50, clientY: 25 },
        { left: 0, top: 0, width: 100, height: 50 },
        { x: 10, y: 20, scale: 2 },
        { width: 200, height: 100 },
      ),
    ).toEqual({ x: 60, y: 45 });
  });

  it("keeps zoom anchored and clamps pan to the extended canvas margin", () => {
    const zoomed = zoomCanvasViewAtPoint(
      { x: 0, y: 0, scale: 1 },
      { width: 1200, height: 720 },
      { x: 0.5, y: 0.5 },
      120,
    );
    expect(zoomed.scale).toBeLessThan(1);
    expect(clampCanvasView({ x: 99999, y: -99999, scale: 1 }, { width: 1200, height: 720 })).toMatchObject({
      scale: 1,
      x: 1636.363636363636,
      y: -981.8181818181818,
    });
    expect(wheelPanDelta({ deltaMode: 1, deltaX: 2, deltaY: -1 })).toEqual(
      expect.objectContaining({ x: expect.closeTo(16.8), y: expect.closeTo(-8.4) }),
    );
  });
});

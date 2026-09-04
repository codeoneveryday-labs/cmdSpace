import { describe, expect, it } from "vitest";
import {
  clearSurfacePlacement,
  INITIAL_CANVAS_PLACEMENT_STATE,
  startFreeSurfacePlacement,
  startSurfacePlacement,
} from "./canvasPlacementStateModel";

describe("useCanvasPlacement model operations", () => {
  it("initializes with empty placement", () => {
    expect(INITIAL_CANVAS_PLACEMENT_STATE.placements).toEqual([]);
    expect(INITIAL_CANVAS_PLACEMENT_STATE.isFreePlacement).toBe(false);
    expect(INITIAL_CANVAS_PLACEMENT_STATE.pendingSurfaceKind).toBeNull();
  });

  it("handles start and clear placement transitions", () => {
    const candidates = [{ x: 10, y: 10, width: 640, height: 400 }];
    const started = startSurfacePlacement("terminal", candidates, false);
    expect(started.pendingSurfaceKind).toBe("terminal");
    expect(started.placements).toEqual(candidates);
    expect(started.isFreePlacement).toBe(false);

    const free = startFreeSurfacePlacement("terminal");
    expect(free.pendingSurfaceKind).toBe("terminal");
    expect(free.isFreePlacement).toBe(true);

    const cleared = clearSurfacePlacement();
    expect(cleared.pendingSurfaceKind).toBeNull();
    expect(cleared.placements).toEqual([]);
  });
});

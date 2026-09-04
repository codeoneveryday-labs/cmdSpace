import { describe, expect, it } from "vitest";
import {
  INITIAL_CANVAS_PLACEMENT_STATE,
  clearSurfacePlacement,
  isCanvasPlacementActive,
  selectPlacementCandidate,
  startFreeSurfacePlacement,
  startSurfacePlacement,
} from "./canvasPlacementStateModel";

describe("canvasPlacementStateModel", () => {
  it("initializes as inactive", () => {
    expect(isCanvasPlacementActive(INITIAL_CANVAS_PLACEMENT_STATE)).toBe(false);
    expect(INITIAL_CANVAS_PLACEMENT_STATE.placements).toEqual([]);
    expect(INITIAL_CANVAS_PLACEMENT_STATE.isFreePlacement).toBe(false);
    expect(INITIAL_CANVAS_PLACEMENT_STATE.pendingSurfaceKind).toBeNull();
  });

  it("handles structured placement start and selection", () => {
    const placements = [
      { x: 10, y: 20, width: 640, height: 400 },
      { x: 700, y: 20, width: 640, height: 400 },
    ];
    const state = startSurfacePlacement("terminal", placements, false);

    expect(isCanvasPlacementActive(state)).toBe(true);
    expect(state.pendingSurfaceKind).toBe("terminal");
    expect(state.placements).toHaveLength(2);
    expect(state.isFreePlacement).toBe(false);

    expect(selectPlacementCandidate(state, 0)).toEqual(placements[0]);
    expect(selectPlacementCandidate(state, 1)).toEqual(placements[1]);
    expect(selectPlacementCandidate(state, 2)).toBeNull();
    expect(selectPlacementCandidate(state, -1)).toBeNull();
  });

  it("handles free placement start and clearing", () => {
    const freeState = startFreeSurfacePlacement("terminal");
    expect(isCanvasPlacementActive(freeState)).toBe(true);
    expect(freeState.pendingSurfaceKind).toBe("terminal");
    expect(freeState.isFreePlacement).toBe(true);
    expect(freeState.placements).toEqual([]);

    const cleared = clearSurfacePlacement();
    expect(isCanvasPlacementActive(cleared)).toBe(false);
    expect(cleared).toEqual(INITIAL_CANVAS_PLACEMENT_STATE);
  });
});

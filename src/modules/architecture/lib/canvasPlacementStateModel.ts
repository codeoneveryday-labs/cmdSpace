import type { LiveSurfaceKind } from "./architectureCanvasTypes";
import type { TerminalPlacement } from "../terminalPlacement";

export type CanvasPlacementState = {
  placements: TerminalPlacement[];
  isFreePlacement: boolean;
  pendingSurfaceKind: LiveSurfaceKind | null;
};

export const INITIAL_CANVAS_PLACEMENT_STATE: CanvasPlacementState = {
  placements: [],
  isFreePlacement: false,
  pendingSurfaceKind: null,
};

export function isCanvasPlacementActive(state: CanvasPlacementState): boolean {
  return state.pendingSurfaceKind !== null || state.placements.length > 0 || state.isFreePlacement;
}

export function startSurfacePlacement(
  kind: LiveSurfaceKind,
  placements: TerminalPlacement[],
  isFree = false,
): CanvasPlacementState {
  return {
    pendingSurfaceKind: kind,
    placements,
    isFreePlacement: isFree,
  };
}

export function startFreeSurfacePlacement(
  kind: LiveSurfaceKind,
): CanvasPlacementState {
  return {
    pendingSurfaceKind: kind,
    placements: [],
    isFreePlacement: true,
  };
}

export function clearSurfacePlacement(): CanvasPlacementState {
  return {
    placements: [],
    isFreePlacement: false,
    pendingSurfaceKind: null,
  };
}

export function selectPlacementCandidate(
  state: CanvasPlacementState,
  index: number,
): TerminalPlacement | null {
  if (index < 0 || index >= state.placements.length) {
    return null;
  }
  return state.placements[index];
}

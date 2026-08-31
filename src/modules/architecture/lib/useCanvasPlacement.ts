import { useCallback, useState } from "react";
import type { LiveSurfaceKind } from "./architectureCanvasTypes";
import type { TerminalPlacement } from "../terminalPlacement";
import {
  type CanvasPlacementState,
  INITIAL_CANVAS_PLACEMENT_STATE,
  clearSurfacePlacement,
  startFreeSurfacePlacement,
  startSurfacePlacement,
} from "./canvasPlacementStateModel";

export function useCanvasPlacement() {
  const [placement, setPlacement] = useState<CanvasPlacementState>(
    INITIAL_CANVAS_PLACEMENT_STATE,
  );

  const beginPlacement = useCallback(
    (kind: LiveSurfaceKind, placements: TerminalPlacement[], isFree = false) => {
      setPlacement(startSurfacePlacement(kind, placements, isFree));
    },
    [],
  );

  const beginFreePlacement = useCallback((kind: LiveSurfaceKind) => {
    setPlacement(startFreeSurfacePlacement(kind));
  }, []);

  const toggleFreePlacement = useCallback(() => {
    setPlacement((curr) => ({
      ...curr,
      isFreePlacement: !curr.isFreePlacement,
    }));
  }, []);

  const resetPlacement = useCallback(() => {
    setPlacement(clearSurfacePlacement());
  }, []);

  return {
    placement,
    setPlacement,
    beginPlacement,
    beginFreePlacement,
    toggleFreePlacement,
    resetPlacement,
    placements: placement.placements,
    isFreePlacement: placement.isFreePlacement,
    pendingSurfaceKind: placement.pendingSurfaceKind,
  };
}

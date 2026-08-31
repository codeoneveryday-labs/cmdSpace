import { useCallback, type RefObject } from "react";
import {
  projectTerminalDockLayouts,
  type TerminalDockStackLayout,
} from "../terminalDockLayout";
import type { CanvasView } from "./useCanvasCamera";

export function useCanvasSurfaceDockTarget({
  svgRef,
  terminalLayouts,
  view,
  viewWidth,
  viewHeight,
  clearTarget,
  resolveTarget,
}: {
  svgRef: RefObject<SVGSVGElement | null>;
  terminalLayouts: TerminalDockStackLayout[];
  view: CanvasView;
  viewWidth: number;
  viewHeight: number;
  clearTarget: () => void;
  resolveTarget: (point: { x: number; y: number }, surfaceId: string) => void;
}) {
  return useCallback(
    (point: { x: number; y: number }, surfaceId: string) => {
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return clearTarget();
      const projectedLayouts = projectTerminalDockLayouts(
        terminalLayouts,
        { x: view.x, y: view.y, width: viewWidth, height: viewHeight },
        { x: svgRect.left, y: svgRect.top, width: svgRect.width, height: svgRect.height },
      );
      if (projectedLayouts.length === 0) return clearTarget();
      resolveTarget(point, surfaceId);
    },
    [
      clearTarget,
      resolveTarget,
      svgRef,
      terminalLayouts,
      view.x,
      view.y,
      viewHeight,
      viewWidth,
    ],
  );
}

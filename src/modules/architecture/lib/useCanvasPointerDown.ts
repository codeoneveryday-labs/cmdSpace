import type { Dispatch, SetStateAction, PointerEvent as ReactPointerEvent } from "react";
import type {
  ArchitectureNode,
  CanvasMode,
  LiveSurfaceKind,
  Point,
  ShapeDrawingMode,
} from "./architectureCanvasTypes";
import type { TerminalPlacement } from "../terminalPlacement";
import { isShapeDrawingMode } from "./architectureCanvasModel";

export function useCanvasPointerDown({
  mode,
  terminalPlacements,
  isFreeTerminalPlacement,
  pendingSurfaceKind,
  svgPointFromClient,
  startPan,
  commitFreeSurfacePlacement,
  beginSurfacePlacement,
  pushHistory,
  createNode,
  setNodes,
  beginDrawing,
  selectSingleNode,
  setConnectSourceId,
  clearSelection,
  resetPlacement,
}: {
  mode: CanvasMode;
  terminalPlacements: TerminalPlacement[];
  isFreeTerminalPlacement: boolean;
  pendingSurfaceKind: LiveSurfaceKind | null;
  svgPointFromClient: (point: { clientX: number; clientY: number }) => Point;
  startPan: (event: Pick<ReactPointerEvent<SVGSVGElement>, "clientX" | "clientY">) => void;
  commitFreeSurfacePlacement: (kind: LiveSurfaceKind, point: Point) => void;
  beginSurfacePlacement: (kind: LiveSurfaceKind) => void;
  pushHistory: () => void;
  createNode: (kind: ShapeDrawingMode, point: Point, fromDrag?: boolean) => ArchitectureNode;
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  beginDrawing: (
    drawing: { id: string; kind: ShapeDrawingMode; start: Point },
    event: ReactPointerEvent<SVGSVGElement>,
  ) => void;
  selectSingleNode: (id: string) => void;
  setConnectSourceId: (id: string | null) => void;
  clearSelection: () => void;
  resetPlacement: () => void;
}) {
  return (event: ReactPointerEvent<SVGSVGElement>) => {
    if (mode === "pan") {
      startPan(event);
      return;
    }

    const point = svgPointFromClient(event);
    if (terminalPlacements.length > 0) {
      if (isFreeTerminalPlacement && pendingSurfaceKind) {
        commitFreeSurfacePlacement(pendingSurfaceKind, point);
      } else {
        resetPlacement();
      }
      return;
    }
    if (mode === "terminal") {
      beginSurfacePlacement("terminal");
      return;
    }
    if (isShapeDrawingMode(mode)) {
      pushHistory();
      const created = createNode(mode, point, true);
      setNodes((current) => [...current, created]);
      beginDrawing(
        { id: created.id, kind: mode, start: point },
        event,
      );
      selectSingleNode(created.id);
      setConnectSourceId(null);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    clearSelection();
    if (mode === "connect") setConnectSourceId(null);
  };
}

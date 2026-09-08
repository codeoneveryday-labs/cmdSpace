import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from "react";
import type { CanvasView } from "./useCanvasCamera";
import type { ArchitectureNode, ArchitectureTerminalDockGroup, CanvasMode, DragState, TerminalDropPreview } from "./architectureCanvasTypes";
import type { TerminalDockStackLayout } from "../terminalDockLayout";
import type { TerminalPlacement } from "../terminalPlacement";
import { useCanvasPointerDown } from "./useCanvasPointerDown";
import { useCanvasPointerMove } from "./useCanvasPointerMove";
import { useCanvasPointerEnd } from "./useCanvasPointerEnd";
import { useCanvasSurfaceDockTarget } from "./useCanvasSurfaceDockTarget";

type Camera = {
  view: CanvasView;
  viewWidth: number;
  viewHeight: number;
  pan: unknown;
  svgPointFromClient: (point: { clientX: number; clientY: number }) => { x: number; y: number };
  startPan: Parameters<typeof useCanvasPointerDown>[0]["startPan"];
  panFromPointer: Parameters<typeof useCanvasPointerMove>[0]["panFromPointer"];
  stopPan: () => void;
  drawableBounds: () => { x: number; y: number; width: number; height: number };
};

type Docking = {
  clearTerminalDockDropTarget: () => void;
  resolveTerminalDockDropTargetAtPoint: (point: { x: number; y: number }, surfaceId: string) => void;
  getTerminalDockDropTarget: ReturnType<typeof import("./useCanvasDocking").useCanvasDocking>["getTerminalDockDropTarget"];
  resolveLiveSurfaceDockTarget?: Parameters<typeof useCanvasPointerMove>[0]["resolveLiveSurfaceDockTarget"];
};

type ShapeGestures = {
  drawing: Parameters<typeof useCanvasPointerEnd>[0]["drawing"];
  updatePointer: Parameters<typeof useCanvasPointerMove>[0]["updateShapeGesture"];
  clear: () => void;
  beginDrawing: Parameters<typeof useCanvasPointerDown>[0]["beginDrawing"];
};

export function useCanvasPointerCoordination({
  mode, selectedNodeIds, svgRef, camera, docking, updateTerminalGroupBounds, shapeGestures,
  drag, nodes, terminalDockGroups, terminalLayouts, terminalNodes, terminalDropPreview,
  pendingSurfaceKind, terminalPlacements, isFreeTerminalPlacement,
  commitFreeSurfacePlacement, beginSurfacePlacement, createNode,
  setNodes, setTerminalDockGroups, setTerminalDropPreview, setDrag, setMode,
  selectSingleNode, pushHistory,
  clearSelection, setConnectSourceId, resetPlacement,
}: {
  mode: CanvasMode;
  selectedNodeIds: string[];
  svgRef: RefObject<SVGSVGElement | null>;
  camera: Camera;
  docking: Docking;
  updateTerminalGroupBounds: Parameters<typeof useCanvasPointerMove>[0]["updateTerminalGroupBounds"];
  shapeGestures: ShapeGestures;
  drag: DragState | null;
  nodes: ArchitectureNode[];
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  terminalLayouts: TerminalDockStackLayout[];
  terminalNodes: ArchitectureNode[];
  terminalDropPreview: TerminalDropPreview | null;
  pendingSurfaceKind: "terminal" | null;
  terminalPlacements: TerminalPlacement[];
  isFreeTerminalPlacement: boolean;
  commitFreeSurfacePlacement: (kind: "terminal", point: { x: number; y: number }) => void;
  beginSurfacePlacement: (kind: "terminal") => void;
  createNode: Parameters<typeof useCanvasPointerDown>[0]["createNode"];
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  setTerminalDockGroups: Dispatch<SetStateAction<ArchitectureTerminalDockGroup[]>>;
  setTerminalDropPreview: Dispatch<SetStateAction<TerminalDropPreview | null>>;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
  setMode: (mode: CanvasMode) => void;
  selectSingleNode: (id: string) => void;
  pushHistory: () => void;
  clearSelection: () => void;
  setConnectSourceId: (id: string | null) => void;
  resetPlacement: () => void;
}) {
  const resolveLiveSurfaceDockTarget = useCanvasSurfaceDockTarget({
    svgRef, terminalLayouts, view: camera.view, viewWidth: camera.viewWidth,
    viewHeight: camera.viewHeight, clearTarget: docking.clearTerminalDockDropTarget,
    resolveTarget: docking.resolveTerminalDockDropTargetAtPoint,
  });
  const pointerMove = useCanvasPointerMove({
    panActive: Boolean(camera.pan), drag, nodes, selectedNodeIds,
    terminalDockGroups, terminalLayouts, panFromPointer: camera.panFromPointer,
    updateShapeGesture: shapeGestures.updatePointer,
    svgPointFromClient: camera.svgPointFromClient, drawableBounds: camera.drawableBounds,
    updateTerminalGroupBounds,
    resolveLiveSurfaceDockTarget, setTerminalDockGroups, setTerminalDropPreview, setNodes,
  });
  const pointerEnd = useCanvasPointerEnd({
    drawing: shapeGestures.drawing, drag, nodes, terminalDockGroups, terminalLayouts,
    terminalNodes, terminalDropPreview, selectedNodeIds,
    getTerminalDockDropTarget: docking.getTerminalDockDropTarget, setMode, setDrag,
    setTerminalDropPreview, clearTerminalDockDropTarget: docking.clearTerminalDockDropTarget,
    stopPan: camera.stopPan, clearShapeGestures: shapeGestures.clear,
    setNodes, setTerminalDockGroups, drawableBounds: camera.drawableBounds,
  });
  const canvasPointerDown = useCanvasPointerDown({
    mode, terminalPlacements, isFreeTerminalPlacement, pendingSurfaceKind,
    svgPointFromClient: camera.svgPointFromClient, startPan: camera.startPan,
    commitFreeSurfacePlacement, beginSurfacePlacement, pushHistory, createNode,
    setNodes, beginDrawing: shapeGestures.beginDrawing, selectSingleNode,
    setConnectSourceId, clearSelection, resetPlacement,
  });
  return { pointerMove, pointerEnd, canvasPointerDown };
}

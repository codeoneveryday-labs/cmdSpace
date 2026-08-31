import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
} from "react";
import type {
  ArchitectureNode,
  CanvasMode,
  DragState,
  Point,
} from "./architectureCanvasTypes";
import type { TerminalDockStackLayout } from "../terminalDockLayout";
import {
  isFreehandKind,
  isLiveSurfaceKind,
} from "./architectureCanvasModel";

export function useCanvasNodePointerDown({
  mode,
  selectedNodeIds,
  svgRef,
  terminalLayoutById,
  svgPointFromClient,
  onErase,
  onConnect,
  startPan,
  toggleNodeSelection,
  selectSingleNode,
  pushHistory,
  clearTerminalDockDropTarget,
  setTerminalDropPreview,
  setDrag,
}: {
  mode: CanvasMode;
  selectedNodeIds: string[];
  svgRef: RefObject<SVGSVGElement | null>;
  terminalLayoutById: ReadonlyMap<string, TerminalDockStackLayout>;
  svgPointFromClient: (point: { clientX: number; clientY: number }) => Point;
  onErase: (id: string) => void;
  onConnect: (id: string) => void;
  startPan: (event: Pick<ReactPointerEvent<SVGGElement>, "clientX" | "clientY">) => void;
  toggleNodeSelection: (id: string) => void;
  selectSingleNode: (id: string) => void;
  pushHistory: () => void;
  clearTerminalDockDropTarget: () => void;
  setTerminalDropPreview: Dispatch<SetStateAction<{ id: string; x: number; y: number; width: number; height: number } | null>>;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
}) {
  return (
    event: ReactPointerEvent<SVGGElement>,
    item: ArchitectureNode,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (mode === "eraser") {
      onErase(item.id);
      return;
    }
    if (mode === "connect") {
      onConnect(item.id);
      return;
    }
    if (mode === "pan") {
      startPan(event);
      return;
    }
    if (event.shiftKey) {
      toggleNodeSelection(item.id);
      return;
    }
    if (!selectedNodeIds.includes(item.id)) {
      selectSingleNode(item.id);
    }
    if (item.locked || isFreehandKind(item.kind)) {
      return;
    }
    const point = svgPointFromClient(event);
    pushHistory();
    setTerminalDropPreview(null);
    clearTerminalDockDropTarget();
    const sourceBounds = isLiveSurfaceKind(item.kind)
      ? terminalLayoutById.get(item.id)?.rect
      : undefined;
    setDrag({
      id: item.id,
      dx: point.x - (sourceBounds?.x ?? item.x),
      dy: point.y - (sourceBounds?.y ?? item.y),
      ...(sourceBounds ? { sourceBounds } : {}),
    });
    svgRef.current?.setPointerCapture(event.pointerId);
  };
}

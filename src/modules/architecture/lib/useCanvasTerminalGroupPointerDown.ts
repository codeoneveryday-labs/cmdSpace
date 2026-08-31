import type {
  PointerEvent as ReactPointerEvent,
  RefObject,
  Dispatch,
  SetStateAction,
} from "react";
import type {
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
  CanvasMode,
  DragState,
} from "./architectureCanvasTypes";

export function useCanvasTerminalGroupPointerDown({
  mode,
  selectedNodeIds,
  svgRef,
  svgPointFromClient,
  onNodePointerDown,
  selectSingleNode,
  pushHistory,
  clearTerminalDockDropTarget,
  setTerminalDropPreview,
  setDrag,
}: {
  mode: CanvasMode;
  selectedNodeIds: string[];
  svgRef: RefObject<SVGSVGElement | null>;
  svgPointFromClient: (point: { clientX: number; clientY: number }) => {
    x: number;
    y: number;
  };
  onNodePointerDown: (
    event: ReactPointerEvent<SVGGElement>,
    node: ArchitectureNode,
  ) => void;
  selectSingleNode: (id: string) => void;
  pushHistory: () => void;
  clearTerminalDockDropTarget: () => void;
  setTerminalDropPreview: Dispatch<SetStateAction<{ id: string; x: number; y: number; width: number; height: number } | null>>;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
}) {
  return (
    event: ReactPointerEvent<HTMLDivElement>,
    group: ArchitectureTerminalDockGroup,
    activeTerminalNode: ArchitectureNode,
    locked: boolean,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (mode !== "select") {
      onNodePointerDown(
        event as unknown as ReactPointerEvent<SVGGElement>,
        activeTerminalNode,
      );
      return;
    }
    if (!selectedNodeIds.includes(activeTerminalNode.id)) {
      selectSingleNode(activeTerminalNode.id);
    }
    if (locked) return;

    const point = svgPointFromClient(event);
    pushHistory();
    setTerminalDropPreview(null);
    clearTerminalDockDropTarget();
    setDrag({
      id: activeTerminalNode.id,
      dx: point.x - group.x,
      dy: point.y - group.y,
      sourceBounds: group,
      terminalGroupId: group.id,
    });
    svgRef.current?.setPointerCapture(event.pointerId);
  };
}

import type { Dispatch, SetStateAction } from "react";
import type {
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
  DragState,
  DrawingState,
  TerminalDropPreview,
} from "./architectureCanvasTypes";
import type {
  TerminalDockDropTarget,
  TerminalDockStackLayout,
} from "../terminalDockLayout";
import {
  snapTerminalFrame,
} from "./architectureCanvasModel";
import {
  commitTerminalDropResult,
  resolveTerminalDropResult,
} from "./useCanvasTerminalInteractions";

export function useCanvasPointerEnd({
  drawing,
  drag,
  nodes,
  terminalDockGroups,
  terminalLayouts,
  terminalNodes,
  terminalDropPreview,
  selectedNodeIds,
  getTerminalDockDropTarget,
  setMode,
  setDrag,
  setTerminalDropPreview,
  clearTerminalDockDropTarget,
  stopPan,
  clearShapeGestures,
  setNodes,
  setTerminalDockGroups,
  drawableBounds,
}: {
  drawing: DrawingState | null;
  drag: DragState | null;
  nodes: ArchitectureNode[];
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  terminalLayouts: TerminalDockStackLayout[];
  terminalNodes: ArchitectureNode[];
  terminalDropPreview: TerminalDropPreview | null;
  selectedNodeIds: string[];
  getTerminalDockDropTarget: () => TerminalDockDropTarget | null;
  setMode: (mode: "select") => void;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
  setTerminalDropPreview: Dispatch<SetStateAction<TerminalDropPreview | null>>;
  clearTerminalDockDropTarget: () => void;
  stopPan: () => void;
  clearShapeGestures: () => void;
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  setTerminalDockGroups: Dispatch<SetStateAction<ArchitectureTerminalDockGroup[]>>;
  drawableBounds: () => { x: number; y: number; width: number; height: number };
}) {
  return () => {
    if (drawing && drawing.kind !== "pen") setMode("select");
    const dragged = drag ? nodes.find((item) => item.id === drag.id) : null;
    const dockTarget = getTerminalDockDropTarget();
    const terminalGroup = drag?.terminalGroupId
      ? terminalDockGroups.find((group) => group.id === drag.terminalGroupId)
      : undefined;
    const result = resolveTerminalDropResult({
      drag,
      dockTarget,
      draggedTerminal: dragged ?? null,
      frameId: terminalGroup
        ? snapTerminalFrame(terminalGroup, nodes)?.nodeId
        : undefined,
      terminalDockGroups,
      terminalDropPreview,
      terminalLayouts,
      terminalNodes,
    });
    commitTerminalDropResult({
      result,
      drag,
      draggedTerminal: dragged ?? null,
      dockTarget,
      terminalLayouts,
      nodes,
      selectedNodeIds,
      terminalDropPreview,
      drawableBounds,
      setNodes,
      setTerminalDockGroups,
    });
    setDrag(null);
    setTerminalDropPreview(null);
    clearTerminalDockDropTarget();
    stopPan();
    clearShapeGestures();
  };
}

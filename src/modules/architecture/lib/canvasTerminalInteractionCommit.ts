import type { ArchitectureTerminalDockGroup } from "@/modules/tabs";
import type { Dispatch, SetStateAction } from "react";
import {
  layoutTerminalDockGroups,
  type TerminalDockDropTarget,
  type TerminalDockStackLayout,
} from "../terminalDockLayout";
import type {
  ArchitectureEdge,
  ArchitectureNode,
  DragState,
  Point,
  TerminalDropPreview,
} from "./architectureCanvasTypes";
import { updateDraggedNodes } from "./architectureCanvasModel";
import type { TerminalDropResult } from "./canvasTerminalInteractionModel";

export function commitTerminalDropResult({
  result,
  drag,
  draggedTerminal,
  dockTarget,
  terminalLayouts,
  nodes,
  selectedNodeIds,
  terminalDropPreview,
  drawableBounds,
  setNodes,
  setTerminalDockGroups,
}: {
  result: TerminalDropResult;
  drag: DragState | null;
  draggedTerminal: ArchitectureNode | null;
  dockTarget: TerminalDockDropTarget | null;
  terminalLayouts: TerminalDockStackLayout[];
  nodes: ArchitectureNode[];
  selectedNodeIds: string[];
  terminalDropPreview: TerminalDropPreview | null;
  drawableBounds: () => { x: number; y: number; width: number; height: number };
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  setTerminalDockGroups: Dispatch<
    SetStateAction<ArchitectureTerminalDockGroup[]>
  >;
}) {
  if (result.kind === "dock" && draggedTerminal?.kind === "terminal") {
    const targetStack = terminalLayouts.find(
      (layout) =>
        layout.groupId === dockTarget?.groupId &&
        layout.stackId === dockTarget?.stackId,
    );
    const targetTerminal = targetStack
      ? nodes.find((item) => item.id === targetStack.activeTerminalId)
      : null;
    setTerminalDockGroups(result.nextGroups);
    if (targetTerminal) {
      setNodes((current) =>
        current.map((item) =>
          item.id === draggedTerminal.id
            ? { ...item, frameId: targetTerminal.frameId }
            : item,
        ),
      );
    }
    return;
  }

  if (result.kind === "detach" && drag && terminalDropPreview) {
    const point: Point = {
      x: terminalDropPreview.x + drag.dx,
      y: terminalDropPreview.y + drag.dy,
    };
    setNodes((current) =>
      updateDraggedNodes(
        current,
        drag,
        point,
        drawableBounds(),
        selectedNodeIds,
      ),
    );
    setTerminalDockGroups(result.nextGroups);
    return;
  }

  if (result.kind === "sync-frame") {
    setNodes((current) =>
      current.map((item) =>
        result.terminalIds.includes(item.id)
          ? { ...item, frameId: result.frameId }
          : item,
      ),
    );
  }
}

export function commitTerminalGroupClose({
  group,
  activeTerminalId,
  maximizedTerminalId,
  pushHistory,
  setNodes,
  setEdges,
  setTerminalDockGroups,
  setActiveTerminalId,
  setMaximizedTerminalId,
  clearSelection,
  setConnectSourceId,
}: {
  group: ArchitectureTerminalDockGroup;
  activeTerminalId: string;
  maximizedTerminalId: string;
  pushHistory: () => void;
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  setEdges: Dispatch<SetStateAction<ArchitectureEdge[]>>;
  setTerminalDockGroups: Dispatch<
    SetStateAction<ArchitectureTerminalDockGroup[]>
  >;
  setActiveTerminalId: Dispatch<SetStateAction<string>>;
  setMaximizedTerminalId: Dispatch<SetStateAction<string>>;
  clearSelection: () => void;
  setConnectSourceId: (id: string | null) => void;
}) {
  const terminalIds = layoutTerminalDockGroups([group]).flatMap(
    (stack) => stack.terminalIds,
  );
  if (terminalIds.length === 0) return;

  pushHistory();
  setNodes((current) =>
    current.filter((item) => !terminalIds.includes(item.id)),
  );
  setTerminalDockGroups((current) =>
    current.filter((item) => item.id !== group.id),
  );
  setEdges((current) =>
    current.filter(
      (item) =>
        !terminalIds.includes(item.from) && !terminalIds.includes(item.to),
    ),
  );
  if (terminalIds.includes(activeTerminalId)) setActiveTerminalId("");
  if (terminalIds.includes(maximizedTerminalId)) setMaximizedTerminalId("");
  clearSelection();
  setConnectSourceId(null);
}

import type {
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
  DragState,
  Point,
} from "./architectureCanvasTypes";
import type { TerminalDockStackLayout } from "../terminalDockLayout";
import {
  attachedTerminalGroupIdsForFrameMove,
  moveTerminalDockGroups,
  snapTerminalFrame,
  snapTextAttachment,
} from "./architectureCanvasAttachmentModel";
import { isFrameAttachableKind } from "./architectureCanvasPredicates";

export function draggedNodeAtPoint(
  node: ArchitectureNode,
  drag: DragState,
  point: Point,
  bounds: { x: number; y: number; width: number; height: number },
): Pick<ArchitectureNode, "x" | "y" | "width" | "height"> {
  const width = drag.sourceBounds?.width ?? node.width;
  const height = drag.sourceBounds?.height ?? node.height;
  return {
    x: clamp(point.x - drag.dx, bounds.x + 16, bounds.x + bounds.width - width - 16),
    y: clamp(point.y - drag.dy, bounds.y + 16, bounds.y + bounds.height - height - 16),
    width,
    height,
  };
}

export function resolveCanvasDragMove({
  nodes,
  drag,
  point,
  bounds,
  selectedNodeIds,
  terminalLayouts,
}: {
  nodes: ArchitectureNode[];
  drag: DragState;
  point: Point;
  bounds: { x: number; y: number; width: number; height: number };
  selectedNodeIds: string[];
  terminalLayouts: TerminalDockStackLayout[];
}) {
  const dragged = nodes.find((item) => item.id === drag.id);
  if (!dragged) return null;
  const nextBounds = draggedNodeAtPoint(dragged, drag, point, bounds);
  const movedNodeIds = new Set(
    selectedNodeIds.includes(dragged.id) ? selectedNodeIds : [dragged.id],
  );
  return {
    dragged,
    nextBounds,
    movedNodeIds,
    attachedTerminalGroupIds: attachedTerminalGroupIdsForFrameMove(
      nodes,
      terminalLayouts,
      movedNodeIds,
    ),
  };
}

export function applyCanvasDragMove({
  nodes,
  terminalDockGroups,
  drag,
  point,
  bounds,
  selectedNodeIds,
  terminalLayouts,
}: {
  nodes: ArchitectureNode[];
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  drag: DragState;
  point: Point;
  bounds: { x: number; y: number; width: number; height: number };
  selectedNodeIds: string[];
  terminalLayouts: TerminalDockStackLayout[];
}) {
  const move = resolveCanvasDragMove({
    nodes,
    drag,
    point,
    bounds,
    selectedNodeIds,
    terminalLayouts,
  });
  if (!move) return { nodes, terminalDockGroups };
  return {
    nodes: updateDraggedNodes(nodes, drag, point, bounds, selectedNodeIds),
    terminalDockGroups: moveTerminalDockGroups(
      terminalDockGroups,
      move.attachedTerminalGroupIds,
      move.nextBounds.x - move.dragged.x,
      move.nextBounds.y - move.dragged.y,
    ),
  };
}

export function updateDraggedNodes(
  nodes: ArchitectureNode[],
  drag: DragState,
  point: Point,
  bounds: { x: number; y: number; width: number; height: number },
  selectedNodeIds: string[],
): ArchitectureNode[] {
  const dragged = nodes.find((item) => item.id === drag.id);
  if (!dragged || dragged.locked) return nodes;
  const { x: nextX, y: nextY } = draggedNodeAtPoint(dragged, drag, point, bounds);
  const dx = nextX - dragged.x;
  const dy = nextY - dragged.y;
  const movedDragged = { ...dragged, x: nextX, y: nextY };
  const groupIds = new Set(
    selectedNodeIds.includes(dragged.id) ? selectedNodeIds : [dragged.id],
  );
  const nextAnchor =
    dragged.kind === "text"
      ? snapTextAttachment(movedDragged, nodes)?.nodeId
      : dragged.textAnchorId;
  const nextFrameId = isFrameAttachableKind(dragged.kind)
    ? snapTerminalFrame(movedDragged, nodes)?.nodeId
    : dragged.frameId;

  return nodes.map((item) => {
    if (item.id === dragged.id) {
      if (dragged.kind === "text") return { ...movedDragged, textAnchorId: nextAnchor };
      if (isFrameAttachableKind(dragged.kind)) return { ...movedDragged, frameId: nextFrameId };
      return movedDragged;
    }
    if (groupIds.has(item.id) && !item.locked) {
      return {
        ...item,
        x: clamp(item.x + dx, bounds.x + 16, bounds.x + bounds.width - item.width - 16),
        y: clamp(item.y + dy, bounds.y + 16, bounds.y + bounds.height - item.height - 16),
      };
    }
    if (
      item.kind === "text" &&
      item.textAnchorId &&
      groupIds.has(item.textAnchorId) &&
      !groupIds.has(item.id)
    ) {
      return { ...item, x: item.x + dx, y: item.y + dy };
    }
    if (
      isFrameAttachableKind(item.kind) &&
      item.frameId &&
      groupIds.has(item.frameId) &&
      !groupIds.has(item.id)
    ) {
      return { ...item, x: item.x + dx, y: item.y + dy };
    }
    return item;
  });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

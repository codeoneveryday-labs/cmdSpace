import {
  boundaryPoint,
  nodeCenter,
  pointInsideNode,
} from "./canvasGeometry";
import type {
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
} from "./architectureCanvasTypes";
import type { TerminalDockStackLayout } from "../terminalDockLayout";
import { isDrawingOnlyKind, isLiveSurfaceKind } from "./architectureCanvasPredicates";
import { distance } from "./architectureSurfaceModel";

export const TEXT_ATTACH_DISTANCE = 32;

export function attachedTerminalGroupIdsForFrameMove(
  nodes: ArchitectureNode[],
  terminalLayouts: TerminalDockStackLayout[],
  movedNodeIds: ReadonlySet<string>,
): Set<string> {
  return new Set(
    terminalLayouts
      .filter((layout) =>
        layout.terminalIds.some((terminalId) => {
          const terminal = nodes.find((item) => item.id === terminalId);
          return (
            terminal !== undefined &&
            isLiveSurfaceKind(terminal.kind) &&
            terminal.frameId !== undefined &&
            movedNodeIds.has(terminal.frameId) &&
            !movedNodeIds.has(terminal.id)
          );
        }),
      )
      .map((layout) => layout.groupId),
  );
}

export function moveTerminalDockGroups(
  groups: ArchitectureTerminalDockGroup[],
  groupIds: ReadonlySet<string>,
  dx: number,
  dy: number,
): ArchitectureTerminalDockGroup[] {
  if (groupIds.size === 0 || (dx === 0 && dy === 0)) return groups;
  return groups.map((group) =>
    groupIds.has(group.id)
      ? { ...group, x: group.x + dx, y: group.y + dy }
      : group,
  );
}

export function snapTextAttachment(
  textNode: ArchitectureNode,
  nodes: ArchitectureNode[],
): { nodeId: string } | null {
  const center = nodeCenter(textNode);
  let nearest: { node: ArchitectureNode; distance: number } | null = null;
  for (const node of nodes) {
    if (
      node.id === textNode.id ||
      node.kind === "text" ||
      isDrawingOnlyKind(node.kind)
    ) {
      continue;
    }
    const inside = pointInsideNode(center, node);
    const nextDistance = inside ? 0 : distance(center, boundaryPoint(node, center));
    if (nextDistance > TEXT_ATTACH_DISTANCE) continue;
    if (!nearest || nextDistance < nearest.distance) {
      nearest = { node, distance: nextDistance };
    }
  }
  return nearest ? { nodeId: nearest.node.id } : null;
}

export function snapTerminalFrame(
  terminal: Pick<ArchitectureNode, "x" | "y" | "width" | "height">,
  nodes: ArchitectureNode[],
): { nodeId: string } | null {
  const center = nodeCenter(terminal);
  const frames = nodes.filter(
    (node) => node.kind === "frame" && pointInsideNode(center, node),
  );
  if (frames.length === 0) return null;

  const closestFrame = frames.reduce((closest, frame) =>
    frame.width * frame.height < closest.width * closest.height
      ? frame
      : closest,
  );
  return { nodeId: closestFrame.id };
}

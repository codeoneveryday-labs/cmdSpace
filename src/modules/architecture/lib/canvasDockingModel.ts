import type {
  ArchitectureDiagramNode,
  ArchitectureTerminalDockGroup,
} from "@/modules/tabs";
import type { TerminalDockStackLayout } from "../terminalDockLayout";
import {
  projectTerminalDockLayouts,
  resolveTerminalDockDrop,
  type TerminalDockDropTarget,
} from "../terminalDockLayout";

export type DockingObstacle = Pick<
  ArchitectureDiagramNode,
  "x" | "y" | "width" | "height"
>;

export function buildTerminalPlacementObstacles({
  nodes,
  terminalNodes,
  terminalDockGroups,
  terminalLayouts,
}: {
  nodes: ArchitectureDiagramNode[];
  terminalNodes: ArchitectureDiagramNode[];
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  terminalLayouts: TerminalDockStackLayout[];
}): DockingObstacle[] {
  const dockedTerminalIds = new Set(
    terminalLayouts.flatMap((layout) => layout.terminalIds),
  );
  return [
    ...nodes
      .filter((node) => node.kind !== "terminal")
      .map(({ x, y, width, height }) => ({ x, y, width, height })),
    ...terminalDockGroups.map(({ x, y, width, height }) => ({
      x,
      y,
      width,
      height,
    })),
    ...terminalNodes
      .filter((node) => !dockedTerminalIds.has(node.id))
      .map(({ x, y, width, height }) => ({ x, y, width, height })),
  ];
}

export function resolveCanvasDockTarget({
  point,
  terminalLayouts,
  draggedTerminalId,
  view,
  viewWidth,
  viewHeight,
  svgRect,
}: {
  point: { x: number; y: number };
  terminalLayouts: TerminalDockStackLayout[];
  draggedTerminalId: string;
  view: { x: number; y: number };
  viewWidth: number;
  viewHeight: number;
  svgRect: { x: number; y: number; width: number; height: number };
}): TerminalDockDropTarget | null {
  const clientLayouts = projectTerminalDockLayouts(
    terminalLayouts,
    { x: view.x, y: view.y, width: viewWidth, height: viewHeight },
    svgRect,
  );
  return resolveTerminalDockDrop(point, clientLayouts, draggedTerminalId);
}

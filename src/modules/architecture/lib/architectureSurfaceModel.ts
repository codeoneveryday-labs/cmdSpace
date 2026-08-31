import { nodeCenter } from "./canvasGeometry";
import type {
  ArchitectureNode,
  LiveSurfaceKind,
} from "./architectureCanvasTypes";

export function surfacePlacementAnchor(
  nodes: ArchitectureNode[],
  kind: LiveSurfaceKind,
  activeSurfaceId: string,
  selectedNode: ArchitectureNode | null,
  view: { x: number; y: number; width: number; height: number },
): Pick<ArchitectureNode, "x" | "y" | "width" | "height"> | undefined {
  const sameKindNodes = nodes.filter((node) => node.kind === kind);
  const activeSurface = sameKindNodes.find(
    (node) => node.id === activeSurfaceId || node.id === selectedNode?.id,
  );
  const viewportCenter = {
    x: view.x + view.width / 2,
    y: view.y + view.height / 2,
  };
  const nearestSurface = sameKindNodes.reduce<ArchitectureNode | null>(
    (nearest, node) => {
      if (!nearest) return node;
      return distance(nodeCenter(node), viewportCenter) <
        distance(nodeCenter(nearest), viewportCenter)
        ? node
        : nearest;
    },
    null,
  );
  const focusNode = activeSurface ?? nearestSurface;
  return focusNode
    ? {
        x: focusNode.x,
        y: focusNode.y,
        width: focusNode.width,
        height: focusNode.height,
      }
    : undefined;
}

export function inheritedSurfaceCwd(
  terminalNodes: ArchitectureNode[],
  activeTerminalId: string,
  selectedNode: ArchitectureNode | null,
): string | undefined {
  return (
    terminalNodes.find((node) => node.id === activeTerminalId)?.cwd ??
    (selectedNode?.kind === "terminal" ? selectedNode.cwd : undefined) ??
    terminalNodes[0]?.cwd
  );
}

export function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

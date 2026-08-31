import { useMemo } from "react";
import type {
  ArchitectureEdge,
  ArchitectureNode,
} from "./architectureCanvasTypes";
import { isLiveSurfaceNode } from "./architectureCanvasModel";

export function useCanvasDiagramViewModel({
  nodes,
  edges,
  selectedNodeId,
  selectedEdgeId,
}: {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
}) {
  const selectedNode =
    nodes.find((node) => node.id === selectedNodeId) ?? null;
  const selectedEdge =
    edges.find((edge) => edge.id === selectedEdgeId) ?? null;
  const selectedLocked = Boolean(selectedNode?.locked || selectedEdge?.locked);
  const nodeById = useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );
  const liveSurfaceNodes = nodes.filter(isLiveSurfaceNode);
  const terminalNodes = liveSurfaceNodes.filter(
    (node) => node.kind === "terminal",
  );
  const interactiveSurfaceNodes = liveSurfaceNodes.filter(
    (node) => node.kind !== "terminal",
  );

  return {
    selectedNode,
    selectedEdge,
    selectedLocked,
    nodeById,
    liveSurfaceNodes,
    terminalNodes,
    interactiveSurfaceNodes,
  };
}

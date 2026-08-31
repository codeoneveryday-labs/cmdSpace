import { useRef, useState } from "react";
import type {
  ArchitectureCanvasProps,
  ArchitectureEdge,
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
} from "./architectureCanvasTypes";
import { nextDiagramIdSequence } from "../diagramIds";
import { normalizeDiagramSeed } from "./architectureDiagramSeed";

export function useCanvasDiagramState(seed: ArchitectureCanvasProps["seed"]) {
  const initialDiagram = normalizeDiagramSeed(seed);
  const nextNodeRef = useRef(
    nextDiagramIdSequence(
      initialDiagram.nodes.map((node) => node.id),
      "n",
    ),
  );
  const nextEdgeRef = useRef(
    nextDiagramIdSequence(
      initialDiagram.edges.map((edge) => edge.id),
      "e",
    ),
  );
  const [nodes, setNodes] = useState<ArchitectureNode[]>(
    () => initialDiagram.nodes,
  );
  const [edges, setEdges] = useState<ArchitectureEdge[]>(
    () => initialDiagram.edges,
  );
  const [terminalDockGroups, setTerminalDockGroups] = useState<
    ArchitectureTerminalDockGroup[]
  >(() => initialDiagram.terminalDockGroups);

  return {
    nodes,
    setNodes,
    edges,
    setEdges,
    terminalDockGroups,
    setTerminalDockGroups,
    nextNodeRef,
    nextEdgeRef,
  };
}

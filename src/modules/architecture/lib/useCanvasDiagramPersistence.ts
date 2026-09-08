import { useEffect } from "react";
import type {
  ArchitectureDiagram,
  ArchitectureEdge,
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
} from "./architectureCanvasTypes";
import { buildPersistedCanvasDiagram } from "./canvasDiagramPersistenceModel";

export function useCanvasDiagramPersistence({
  tabId,
  nodes,
  edges,
  terminalDockGroups,
  onDiagramChange,
}: {
  tabId: number;
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  onDiagramChange?: (tabId: number, diagram: ArchitectureDiagram) => void;
}) {
  useEffect(() => {
    onDiagramChange?.(
      tabId,
      buildPersistedCanvasDiagram({
        nodes,
        edges,
        terminalDockGroups,
      }),
    );
  }, [
    edges,
    nodes,
    onDiagramChange,
    tabId,
    terminalDockGroups,
  ]);
}

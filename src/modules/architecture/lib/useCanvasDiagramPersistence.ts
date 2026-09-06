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
  canvasPurpose,
  orchestrationProvider,
  orchestrationRunId,
  nodes,
  edges,
  terminalDockGroups,
  onDiagramChange,
}: {
  tabId: number;
  canvasPurpose: ArchitectureDiagram["canvasPurpose"];
  orchestrationProvider: ArchitectureDiagram["orchestrationProvider"];
  orchestrationRunId: ArchitectureDiagram["orchestrationRunId"];
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  onDiagramChange?: (tabId: number, diagram: ArchitectureDiagram) => void;
}) {
  useEffect(() => {
    onDiagramChange?.(
      tabId,
      buildPersistedCanvasDiagram({
        canvasPurpose,
        orchestrationProvider,
        orchestrationRunId,
        nodes,
        edges,
        terminalDockGroups,
      }),
    );
  }, [
    canvasPurpose,
    edges,
    nodes,
    onDiagramChange,
    orchestrationProvider,
    orchestrationRunId,
    tabId,
    terminalDockGroups,
  ]);
}

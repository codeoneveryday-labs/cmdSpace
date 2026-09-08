import type { Dispatch, SetStateAction } from "react";

import type { ArchitectureDiagram } from "@/modules/tabs";
import type { ArchitectureNode } from "./architectureCanvasTypes";
import { useCanvasDiagramPersistence } from "./useCanvasDiagramPersistence";
import { useCanvasTerminalSizeMigration } from "./useCanvasTerminalSizeMigration";

/** Owns Canvas effects that synchronize native/runtime state with the diagram. */
export function useCanvasLifecycle({
  tabId,
  nodes,
  edges,
  terminalDockGroups,
  setNodes,
  onDiagramChange,
}: {
  tabId: number;
  nodes: ArchitectureNode[];
  edges: Parameters<typeof useCanvasDiagramPersistence>[0]["edges"];
  terminalDockGroups: Parameters<typeof useCanvasDiagramPersistence>[0]["terminalDockGroups"];
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  onDiagramChange?: (tabId: number, diagram: ArchitectureDiagram) => void;
}) {
  useCanvasTerminalSizeMigration(setNodes);
  useCanvasDiagramPersistence({
    tabId,
    nodes,
    edges,
    terminalDockGroups,
    onDiagramChange,
  });
}

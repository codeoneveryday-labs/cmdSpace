import type { Dispatch, MutableRefObject, SetStateAction } from "react";

import type { ArchitectureDiagram } from "@/modules/tabs";
import type { CanvasTerminalHandle } from "../CanvasTerminalNode";
import type { ArchitectureNode } from "./architectureCanvasTypes";
import { useCanvasDiagramPersistence } from "./useCanvasDiagramPersistence";
import { useCanvasOrchestrationIntegration } from "./useCanvasOrchestrationIntegration";
import { useCanvasTerminalSizeMigration } from "./useCanvasTerminalSizeMigration";

/** Owns Canvas effects that synchronize native/runtime state with the diagram. */
export function useCanvasLifecycle({
  tabId,
  canvasPurpose,
  orchestrationProvider,
  orchestrationRunId,
  workspaceId,
  workspaceCwd,
  nodes,
  edges,
  terminalDockGroups,
  setNodes,
  terminalHandles,
  onDiagramChange,
  onRunIdChange,
}: {
  tabId: number;
  canvasPurpose: Parameters<typeof useCanvasOrchestrationIntegration>[0]["canvasPurpose"];
  orchestrationProvider: Parameters<typeof useCanvasOrchestrationIntegration>[0]["orchestrationProvider"];
  orchestrationRunId: string | null | undefined;
  workspaceId: string | null | undefined;
  workspaceCwd: string | null | undefined;
  nodes: ArchitectureNode[];
  edges: Parameters<typeof useCanvasDiagramPersistence>[0]["edges"];
  terminalDockGroups: Parameters<typeof useCanvasDiagramPersistence>[0]["terminalDockGroups"];
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  terminalHandles: MutableRefObject<Map<string, CanvasTerminalHandle>>;
  onDiagramChange?: (tabId: number, diagram: ArchitectureDiagram) => void;
  onRunIdChange: (runId: string | null) => void;
}) {
  const orchestration = useCanvasOrchestrationIntegration({
    canvasPurpose,
    orchestrationRunId,
    workspaceId,
    workspaceCwd,
    orchestrationProvider,
    nodes,
    setNodes,
    terminalHandles,
    onRunIdChange,
  });

  useCanvasTerminalSizeMigration(setNodes);
  useCanvasDiagramPersistence({
    tabId,
    canvasPurpose,
    orchestrationProvider,
    orchestrationRunId,
    nodes,
    edges,
    terminalDockGroups,
    onDiagramChange,
  });
  return orchestration;
}

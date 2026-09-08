import { useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import type { CanvasPurpose, OrchestrationProvider } from "@/modules/tabs";
import type { CanvasTerminalHandle } from "../CanvasTerminalNode";
import type { ArchitectureNode } from "./architectureCanvasTypes";
import { useCanvasOrchestrationRun } from "./useCanvasOrchestrationRun";
import { useCanvasOrchestrationWorkers } from "./useCanvasOrchestrationWorkers";

export function useCanvasOrchestrationIntegration({
  canvasPurpose,
  orchestrationRunId,
  workspaceId,
  workspaceCwd,
  orchestrationProvider,
  nodes,
  setNodes,
  terminalHandles,
  onRunIdChange,
}: {
  canvasPurpose?: CanvasPurpose;
  orchestrationRunId?: string | null;
  workspaceId?: string | null;
  workspaceCwd?: string | null;
  orchestrationProvider?: OrchestrationProvider;
  nodes: readonly ArchitectureNode[];
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  terminalHandles: MutableRefObject<Map<string, CanvasTerminalHandle>>;
  onRunIdChange?: (runId: string | null) => void;
}) {
  useCanvasOrchestrationWorkers({
    canvasPurpose,
    orchestrationRunId,
    nodes,
    setNodes,
    terminalHandles,
  });

  const orchestration = useCanvasOrchestrationRun({
    canvasPurpose,
    orchestrationRunId,
    workspaceId,
    workspaceCwd,
    orchestrationProvider,
    onRunIdChange,
  });

  const taskStatuses = useMemo(
    () =>
      new Map(
        (orchestration.run?.tasks ?? []).map((task) => [task.taskId, task.status]),
      ),
    [orchestration.run],
  );

  return {
    ...orchestration,
    taskStatuses,
  };
}

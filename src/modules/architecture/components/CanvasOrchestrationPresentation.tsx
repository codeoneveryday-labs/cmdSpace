import type { OrchestrationRun } from "../lib/orchestrationRuntime";
import type { OrchestrationToolbarControls } from "./OrchestrationToolbarSection";
import { OrchestrationMailOverlay } from "./OrchestrationMailOverlay";
import type { ArchitectureNode } from "../lib/architectureCanvasTypes";
import type { OrchestrationMailFlightSeed } from "../lib/useCanvasOrchestrationRun";

type View = { x: number; y: number };

export function buildOrchestrationToolbarControls(
  enabled: boolean,
  orchestration: {
    run: OrchestrationRun | null;
    busy: boolean;
    error: string | null;
    startRun: OrchestrationToolbarControls["onStartRun"];
    saveDraft: OrchestrationToolbarControls["onSaveDraft"];
    approveRun: OrchestrationToolbarControls["onApprove"];
    completeTask: OrchestrationToolbarControls["onCompleteTask"];
    retryTask: OrchestrationToolbarControls["onRetryTask"];
    reindexMemories: OrchestrationToolbarControls["onReindexMemories"];
    searchMemories: OrchestrationToolbarControls["onSearchMemories"];
  },
): OrchestrationToolbarControls | null {
  if (!enabled) return null;
  return {
    run: orchestration.run,
    busy: orchestration.busy,
    error: orchestration.error,
    onStartRun: orchestration.startRun,
    onSaveDraft: orchestration.saveDraft,
    onApprove: orchestration.approveRun,
    onCompleteTask: orchestration.completeTask,
    onRetryTask: orchestration.retryTask,
    onReindexMemories: orchestration.reindexMemories,
    onSearchMemories: orchestration.searchMemories,
  };
}

export function CanvasOrchestrationPresentation({
  enabled,
  run,
  nodes,
  flights,
  view,
  viewWidth,
  viewHeight,
  onFlightDone,
}: {
  enabled: boolean;
  run: OrchestrationRun | null;
  nodes: readonly ArchitectureNode[];
  flights: OrchestrationMailFlightSeed[];
  view: View;
  viewWidth: number;
  viewHeight: number;
  onFlightDone: (key: string) => void;
}) {
  if (!enabled) return null;
  return (
    <OrchestrationMailOverlay
      run={run}
      nodes={nodes}
      flights={flights}
      view={view}
      viewWidth={viewWidth}
      viewHeight={viewHeight}
      onFlightDone={onFlightDone}
    />
  );
}

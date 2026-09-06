import type { ComponentProps } from "react";
import { ImportSessionDialog } from "./ImportSessionDialog";
import { WorkspaceAgentAssignmentSummary } from "./WorkspaceAgentAssignmentSummary";
import { WorkspaceAgentSelectionGrid } from "./WorkspaceAgentSelectionGrid";
import { WorkspaceSetupOrchestratorSelection } from "./WorkspaceSetupOrchestratorSelection";

type Props = {
  assignment: ComponentProps<typeof WorkspaceAgentAssignmentSummary>;
  selection: ComponentProps<typeof WorkspaceAgentSelectionGrid>;
  importDialog: ComponentProps<typeof ImportSessionDialog>;
  orchestrator?: ComponentProps<typeof WorkspaceSetupOrchestratorSelection>;
};

export function WorkspaceSetupAgentsStep({
  assignment,
  selection,
  importDialog,
  orchestrator,
}: Props) {
  return (
    <>
      {orchestrator ? (
        <section className="space-y-4">
          <WorkspaceSetupOrchestratorSelection {...orchestrator} />
          <div className="border-t border-border/50 pt-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
              <h2 className="text-sm font-semibold text-foreground">Assign worker CLI agents</h2>
              <span className="text-[11px] text-muted-foreground/70">
                Every remaining terminal must run a worker CLI agent.
              </span>
            </div>
            <div className="mt-3 rounded-lg border border-sky-400/35 bg-sky-500/[0.06] px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {assignment.assignedAgentTerminals} / {assignment.terminalCount}
                </span>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-sky-500 transition-[width]"
                    style={{
                      width: `${assignment.terminalCount === 0 ? 100 : Math.min(100, (assignment.assignedAgentTerminals / assignment.terminalCount) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">Boss uses 1 terminal</span>
              </div>
            </div>
            <div className="mt-3">
              <WorkspaceAgentSelectionGrid {...selection} />
            </div>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <WorkspaceAgentAssignmentSummary {...assignment} />
          <WorkspaceAgentSelectionGrid {...selection} />
        </section>
      )}
      {!orchestrator ? <ImportSessionDialog {...importDialog} /> : null}
    </>
  );
}

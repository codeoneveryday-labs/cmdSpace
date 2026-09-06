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
      {orchestrator ? <WorkspaceSetupOrchestratorSelection {...orchestrator} /> : (
        <section className="space-y-4">
          <WorkspaceAgentAssignmentSummary {...assignment} />
          <WorkspaceAgentSelectionGrid {...selection} />
        </section>
      )}
      <ImportSessionDialog {...importDialog} />
    </>
  );
}

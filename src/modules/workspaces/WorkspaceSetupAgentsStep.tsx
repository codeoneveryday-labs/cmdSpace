import type { ComponentProps } from "react";
import { ImportSessionDialog } from "./ImportSessionDialog";
import { WorkspaceAgentAssignmentSummary } from "./WorkspaceAgentAssignmentSummary";
import { WorkspaceAgentSelectionGrid } from "./WorkspaceAgentSelectionGrid";

type Props = {
  assignment: ComponentProps<typeof WorkspaceAgentAssignmentSummary>;
  selection: ComponentProps<typeof WorkspaceAgentSelectionGrid>;
  importDialog: ComponentProps<typeof ImportSessionDialog>;
};

export function WorkspaceSetupAgentsStep({
  assignment,
  selection,
  importDialog,
}: Props) {
  return (
    <>
      <section className="space-y-4">
        <WorkspaceAgentAssignmentSummary {...assignment} />
        <WorkspaceAgentSelectionGrid {...selection} />
      </section>
      <ImportSessionDialog {...importDialog} />
    </>
  );
}

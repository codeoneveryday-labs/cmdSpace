import { useCallback } from "react";

export function useWorkspaceSetupNavigation({
  setupStep,
  plannedAgentCommands,
  setSetupStep,
  openWorkspace,
  onCancel,
}: {
  setupStep: "layout" | "agents";
  plannedAgentCommands: string[];
  setSetupStep: (step: "layout" | "agents") => void;
  openWorkspace: () => void;
  onCancel: () => void;
}) {
  const handleBack = useCallback(() => {
    if (setupStep === "agents") {
      setSetupStep("layout");
      return;
    }
    onCancel();
  }, [onCancel, setSetupStep, setupStep]);

  const handlePrimaryAction = useCallback(() => {
    if (setupStep === "layout") {
      setSetupStep("agents");
      return;
    }
    if (plannedAgentCommands.length > 0) {
      openWorkspace();
    }
  }, [openWorkspace, plannedAgentCommands, setSetupStep, setupStep]);

  return { handleBack, handlePrimaryAction };
}

import { useCallback } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";

export function useWorkspaceSetupNavigation({
  setupStep,
  plannedAgentCommands,
  selectedChatAgent,
  setSetupStep,
  openWorkspace,
  onCancel,
}: {
  setupStep: "layout" | "agents";
  plannedAgentCommands: string[];
  selectedChatAgent: CliAgent | null;
  setSetupStep: (step: "layout" | "agents") => void;
  openWorkspace: (commands: string[]) => void;
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
    if (plannedAgentCommands.length > 0 && selectedChatAgent) {
      openWorkspace(plannedAgentCommands);
    }
  }, [openWorkspace, plannedAgentCommands, selectedChatAgent, setSetupStep, setupStep]);

  return { handleBack, handlePrimaryAction };
}

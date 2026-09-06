import { useCallback } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { CanvasPurpose, OrchestrationProvider } from "@/modules/tabs";

export function useWorkspaceSetupNavigation({
  setupStep,
  plannedAgentCommands,
  selectedChatAgent,
  workspaceMode,
  canvasPurpose,
  selectedOrchestratorProvider,
  orchestratorAvailable,
  orchestrationWorkersComplete,
  setSetupStep,
  openWorkspace,
  onCancel,
}: {
  setupStep: "layout" | "agents";
  plannedAgentCommands: string[];
  selectedChatAgent: CliAgent | null;
  workspaceMode: "standard" | "canvas" | "agent";
  canvasPurpose: CanvasPurpose;
  selectedOrchestratorProvider: OrchestrationProvider;
  orchestratorAvailable: boolean;
  orchestrationWorkersComplete: boolean;
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
    if (
      workspaceMode === "canvas" &&
      canvasPurpose === "orchestration" &&
      orchestratorAvailable &&
      orchestrationWorkersComplete &&
      selectedOrchestratorProvider
    ) {
      openWorkspace();
      return;
    }
    if (plannedAgentCommands.length > 0 && selectedChatAgent) {
      openWorkspace();
    }
  }, [
    canvasPurpose,
    openWorkspace,
    orchestratorAvailable,
    orchestrationWorkersComplete,
    plannedAgentCommands,
    selectedChatAgent,
    selectedOrchestratorProvider,
    setSetupStep,
    setupStep,
    workspaceMode,
  ]);

  return { handleBack, handlePrimaryAction };
}

import { useCallback, useRef } from "react";
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
  const latestLaunch = useRef({
    setupStep,
    plannedAgentCommands,
    selectedChatAgent,
    openWorkspace,
  });
  latestLaunch.current = {
    setupStep,
    plannedAgentCommands,
    selectedChatAgent,
    openWorkspace,
  };

  const handleBack = useCallback(() => {
    if (setupStep === "agents") {
      setSetupStep("layout");
      return;
    }
    onCancel();
  }, [onCancel, setSetupStep, setupStep]);

  const handlePrimaryAction = useCallback(() => {
    const launch = latestLaunch.current;
    if (launch.setupStep === "layout") {
      setSetupStep("agents");
      return;
    }
    if (launch.plannedAgentCommands.length > 0 && launch.selectedChatAgent) {
      launch.openWorkspace(launch.plannedAgentCommands);
    }
  }, [setSetupStep]);

  return { handleBack, handlePrimaryAction };
}

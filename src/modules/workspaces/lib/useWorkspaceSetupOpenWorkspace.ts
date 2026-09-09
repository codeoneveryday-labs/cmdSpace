import { useCallback, useRef } from "react";
import type { ImportableAgentSession } from "./importSessions";
import { buildWorkspaceLaunchCommands } from "./workspaceSetupModel";

export function useWorkspaceSetupOpenWorkspace({
  terminalCount,
  selectedFolder,
  workspaceName,
  workspaceColor,
  workspaceMode,
  agentCounts,
  selectedImportSessions,
  effectiveAgentCommands,
  customCommand,
  isolateAgentWorktrees,
  agentWorktreeGroup,
  onOpenWithoutAi,
  onCancel,
}: {
  terminalCount: number;
  selectedFolder: string;
  workspaceName: string;
  workspaceColor: string;
  workspaceMode: "standard" | "canvas";
  agentCounts: Record<string, number>;
  selectedImportSessions: ImportableAgentSession[];
  effectiveAgentCommands: Record<string, string>;
  customCommand: string;
  isolateAgentWorktrees: boolean;
  agentWorktreeGroup: string;
  onOpenWithoutAi: (
    terminalCount: number,
    workingFolder: string | null,
    initialCommands?: string[],
    workspaceName?: string,
    workspaceColor?: string,
    workspaceMode?: "standard" | "canvas",
  ) => void;
  onCancel: () => void;
}) {
  const latest = useRef({
    terminalCount,
    selectedFolder,
    workspaceName,
    workspaceColor,
    workspaceMode,
    agentCounts,
    selectedImportSessions,
    effectiveAgentCommands,
    customCommand,
    isolateAgentWorktrees,
    agentWorktreeGroup,
    onOpenWithoutAi,
    onCancel,
  });
  latest.current = {
    terminalCount,
    selectedFolder,
    workspaceName,
    workspaceColor,
    workspaceMode,
    agentCounts,
    selectedImportSessions,
    effectiveAgentCommands,
    customCommand,
    isolateAgentWorktrees,
    agentWorktreeGroup,
    onOpenWithoutAi,
    onCancel,
  };

  return useCallback(
    () => {
      const current = latest.current;
      const launchCommands = buildWorkspaceLaunchCommands({
        agentCounts: current.agentCounts,
        customCommand: current.customCommand,
        effectiveCommands: current.effectiveAgentCommands,
        selectedImportSessions: current.selectedImportSessions,
        cliTerminalCapacity: Math.max(0, current.terminalCount - current.selectedImportSessions.length),
        isolateAgentWorktrees: current.isolateAgentWorktrees,
        agentWorktreeGroup: current.agentWorktreeGroup,
      });
      current.onOpenWithoutAi(
        current.terminalCount,
        current.selectedFolder || null,
        launchCommands,
        current.workspaceName,
        current.workspaceColor,
        current.workspaceMode,
      );
      current.onCancel();
    },
    [],
  );
}

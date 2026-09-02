import { useCallback, useRef } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";
import type { ImportableAgentSession } from "./importSessions";
import { buildWorkspaceLaunchCommands } from "./workspaceSetupModel";

export function useWorkspaceSetupOpenWorkspace({
  terminalCount,
  selectedFolder,
  workspaceName,
  workspaceColor,
  workspaceMode,
  selectedChatAgent,
  agentCounts,
  selectedImportSessions,
  effectiveAgentCommands,
  customCommand,
  isolateAgentWorktrees,
  agentWorktreeGroup,
  forkContext,
  forkPrompt,
  onOpenWithoutAi,
  onCancel,
}: {
  terminalCount: number;
  selectedFolder: string;
  workspaceName: string;
  workspaceColor: string;
  workspaceMode: "standard" | "canvas" | "agent";
  selectedChatAgent: CliAgent | null;
  agentCounts: Record<string, number>;
  selectedImportSessions: ImportableAgentSession[];
  effectiveAgentCommands: Record<string, string>;
  customCommand: string;
  isolateAgentWorktrees: boolean;
  agentWorktreeGroup: string;
  forkContext?: { provider: CliAgent; attachment: AgentChatHistoryAttachment } | null;
  forkPrompt: string;
  onOpenWithoutAi: (
    terminalCount: number,
    workingFolder: string | null,
    initialCommands?: string[],
    workspaceName?: string,
    workspaceColor?: string,
    workspaceMode?: "standard" | "canvas" | "agent",
    workspaceAgent?: CliAgent | null,
    workspaceAgents?: CliAgent[],
    initialAgentDraft?: string,
    initialHistoryAttachments?: AgentChatHistoryAttachment[],
  ) => void;
  onCancel: () => void;
}) {
  const latest = useRef({
    terminalCount,
    selectedFolder,
    workspaceName,
    workspaceColor,
    workspaceMode,
    selectedChatAgent,
    agentCounts,
    selectedImportSessions,
    effectiveAgentCommands,
    customCommand,
    isolateAgentWorktrees,
    agentWorktreeGroup,
    forkContext,
    forkPrompt,
    onOpenWithoutAi,
    onCancel,
  });
  latest.current = {
    terminalCount,
    selectedFolder,
    workspaceName,
    workspaceColor,
    workspaceMode,
    selectedChatAgent,
    agentCounts,
    selectedImportSessions,
    effectiveAgentCommands,
    customCommand,
    isolateAgentWorktrees,
    agentWorktreeGroup,
    forkContext,
    forkPrompt,
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
        cliTerminalCapacity: Math.max(
          0,
          current.terminalCount - current.selectedImportSessions.length,
        ),
        isolateAgentWorktrees: current.isolateAgentWorktrees,
        agentWorktreeGroup: current.agentWorktreeGroup,
      });
      const selectedWorkspaceAgents = Object.entries(current.agentCounts).flatMap(
        ([agentId, count]) =>
          agentId === "custom"
            ? []
            : Array.from({ length: count }, () => agentId as CliAgent),
      );
      if (current.workspaceMode === "agent") {
        selectedWorkspaceAgents.unshift(
          ...current.selectedImportSessions.map((session) => session.provider),
        );
      }
      const initialAgentDraft = current.forkContext
        ? current.forkPrompt.trim()
        : undefined;
      current.onOpenWithoutAi(
        current.terminalCount,
        current.selectedFolder || null,
        launchCommands,
        current.workspaceName,
        current.workspaceColor,
        current.workspaceMode,
        current.workspaceMode === "agent" ? current.selectedChatAgent : null,
        current.workspaceMode === "agent"
          ? selectedWorkspaceAgents.slice(0, 12)
          : undefined,
        initialAgentDraft,
        current.forkContext ? [current.forkContext.attachment] : undefined,
      );
      current.onCancel();
    },
    [],
  );
}

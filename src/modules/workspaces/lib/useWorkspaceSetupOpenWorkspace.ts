import { useCallback } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";
import type { ImportableAgentSession } from "./importSessions";

export function useWorkspaceSetupOpenWorkspace({
  terminalCount,
  selectedFolder,
  workspaceName,
  workspaceColor,
  workspaceMode,
  selectedChatAgent,
  agentCounts,
  selectedImportSessions,
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
  return useCallback(
    (initialCommands?: string[]) => {
      const selectedWorkspaceAgents = Object.entries(agentCounts).flatMap(
        ([agentId, count]) =>
          agentId === "custom"
            ? []
            : Array.from({ length: count }, () => agentId as CliAgent),
      );
      if (workspaceMode === "agent") {
        selectedWorkspaceAgents.unshift(
          ...selectedImportSessions.map((session) => session.provider),
        );
      }
      const initialAgentDraft = forkContext ? forkPrompt.trim() : undefined;
      onOpenWithoutAi(
        terminalCount,
        selectedFolder || null,
        initialCommands,
        workspaceName,
        workspaceColor,
        workspaceMode,
        workspaceMode === "agent" ? selectedChatAgent : null,
        workspaceMode === "agent"
          ? selectedWorkspaceAgents.slice(0, 12)
          : undefined,
        initialAgentDraft,
        forkContext ? [forkContext.attachment] : undefined,
      );
      onCancel();
    },
    [
      agentCounts,
      forkContext,
      forkPrompt,
      onCancel,
      onOpenWithoutAi,
      selectedChatAgent,
      selectedFolder,
      selectedImportSessions,
      terminalCount,
      workspaceColor,
      workspaceMode,
      workspaceName,
    ],
  );
}

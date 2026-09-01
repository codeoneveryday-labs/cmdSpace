import { useCallback } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { WorkspaceRecord } from "./useWorkspaceController";

type Input = {
  workspacesRef: { current: WorkspaceRecord[] };
  updateTab: (tabId: number, patch: { nativeSessionId: string }) => void;
  setWorkspaces: React.Dispatch<React.SetStateAction<WorkspaceRecord[]>>;
  persistWorkspace: (workspace: WorkspaceRecord) => Promise<unknown>;
};

export function useWorkspaceAgentSessionIdentity({
  workspacesRef,
  updateTab,
  setWorkspaces,
  persistWorkspace,
}: Input) {
  return useCallback(
    (
      workspaceId: string,
      tabId: number,
      chatId: string,
      provider: CliAgent,
      nativeSessionId: string,
    ) => {
      const workspace = workspacesRef.current.find((item) => item.id === workspaceId);
      if (!workspace) return;

      updateTab(tabId, { nativeSessionId });
      const tabIndex =
        workspace.agentChatIds?.indexOf(chatId) ??
        workspace.agentTabIds?.indexOf(tabId) ??
        -1;
      const agentProviders = [...(workspace.agentProviders ?? [])];
      if (tabIndex >= 0) agentProviders[tabIndex] = provider;
      const agentSessionIds = [...(workspace.agentSessionIds ?? [])];
      if (tabIndex >= 0) agentSessionIds[tabIndex] = nativeSessionId;
      else if (agentSessionIds.length === 0) agentSessionIds[0] = nativeSessionId;

      const updated: WorkspaceRecord = {
        ...workspace,
        agentSessionId: nativeSessionId,
        agentProviders,
        agentSessionIds,
        updatedAt: Date.now(),
      };
      setWorkspaces((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      void persistWorkspace(updated).catch((error) => {
        console.error("Failed to persist agent session identity:", error);
      });
    },
    [persistWorkspace, setWorkspaces, updateTab, workspacesRef],
  );
}

import { invoke } from "@tauri-apps/api/core";
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { WorkspaceRecord } from "./useWorkspaceController";
import { updateWorkspaceAgentSessionIdentity } from "./workspaceAgentSessionModel";

export function useAppAgentSessionIdentity({
  workspacesRef,
  setWorkspaces,
  updateTab,
}: {
  workspacesRef: MutableRefObject<readonly WorkspaceRecord[]>;
  setWorkspaces: Dispatch<SetStateAction<WorkspaceRecord[]>>;
  updateTab: (tabId: number, patch: { nativeSessionId: string }) => void;
}) {
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
      const updated = updateWorkspaceAgentSessionIdentity(
        workspace,
        tabId,
        chatId,
        provider,
        nativeSessionId,
        Date.now(),
      );
      setWorkspaces((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      void invoke("db_save_workspace", { workspace: updated }).catch((error) => {
        console.error("Failed to persist agent session identity:", error);
      });
    },
    [setWorkspaces, updateTab, workspacesRef],
  );
}

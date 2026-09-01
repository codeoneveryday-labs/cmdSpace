import { invoke } from "@tauri-apps/api/core";
import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { WorkspaceRecord } from "./useWorkspaceController";
import { appendForkedAgentTab } from "./workspaceForkModel";

export type WorkspaceForkContext = {
  provider: CliAgent;
  cwd: string;
  attachment: AgentChatHistoryAttachment;
};

export function useWorkspaceForkActions({
  workspacesRef,
  setWorkspaces,
  newAgentChatTab,
  saveRecentWorkspace,
  setWorkspaceForkContext,
  setWorkspaceSetupOpen,
}: {
  workspacesRef: MutableRefObject<readonly WorkspaceRecord[]>;
  setWorkspaces: Dispatch<SetStateAction<WorkspaceRecord[]>>;
  newAgentChatTab: (input: {
    title: string;
    provider: CliAgent;
    cwd: string;
    chatId: string;
    nativeSessionId: string | null;
    initialHistoryAttachments: AgentChatHistoryAttachment[];
  }) => number;
  saveRecentWorkspace: (workspace: WorkspaceRecord) => void;
  setWorkspaceForkContext: Dispatch<SetStateAction<WorkspaceForkContext | null>>;
  setWorkspaceSetupOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const handleForkAgentResponse = useCallback(
    (input: {
      workspaceId: string;
      provider: CliAgent;
      cwd: string;
      destination: "tab" | "workspace";
      attachment: AgentChatHistoryAttachment;
    }) => {
      const workspace = workspacesRef.current.find(
        (item) => item.id === input.workspaceId,
      );
      if (!workspace) return;

      if (input.destination === "tab") {
        const nextIndex = (workspace.agentChatIds?.length ?? 0) + 1;
        const chatId = `${workspace.id}:fork:${Date.now()}`;
        const tabId = newAgentChatTab({
          title: `${workspace.name} · ${nextIndex}`,
          provider: input.provider,
          cwd: input.cwd,
          chatId,
          nativeSessionId: null,
          initialHistoryAttachments: [input.attachment],
        });
        const updated = appendForkedAgentTab(
          workspace,
          tabId,
          chatId,
          input.provider,
          Date.now(),
        );
        setWorkspaces((current) =>
          current.map((item) => (item.id === workspace.id ? updated : item)),
        );
        saveRecentWorkspace(updated);
        void invoke("db_save_workspace", { workspace: updated }).catch((error) => {
          console.error("Failed to persist forked agent chat:", error);
        });
        return;
      }

      setWorkspaceForkContext({
        provider: input.provider,
        cwd: input.cwd,
        attachment: input.attachment,
      });
      setWorkspaceSetupOpen(true);
    },
    [
      newAgentChatTab,
      saveRecentWorkspace,
      setWorkspaceForkContext,
      setWorkspaceSetupOpen,
      setWorkspaces,
      workspacesRef,
    ],
  );

  return { handleForkAgentResponse };
}

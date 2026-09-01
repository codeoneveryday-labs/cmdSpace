import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { WorkspaceRecord } from "./useWorkspaceController";

export function appendForkedAgentTab(
  workspace: WorkspaceRecord,
  tabId: number,
  chatId: string,
  provider: CliAgent,
  updatedAt: number,
): WorkspaceRecord {
  return {
    ...workspace,
    tabId: workspace.tabId ?? tabId,
    agentTabIds: [...(workspace.agentTabIds ?? []), tabId],
    agentProviders: [...(workspace.agentProviders ?? []), provider],
    agentSessionIds: [...(workspace.agentSessionIds ?? []), null],
    agentChatIds: [...(workspace.agentChatIds ?? []), chatId],
    count: (workspace.agentTabIds?.length ?? 0) + 1,
    updatedAt,
  };
}

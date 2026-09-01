import {
  detectCliAgent,
  type CliAgent,
} from "@/modules/terminal/lib/cliAgents";
import type { WorkspaceRecord } from "./workspaceControllerTypes";

export function prepareAgentWorkspaceTerminal(
  workspace: WorkspaceRecord,
  command: string,
  existingAgentTabCount: number,
): {
  provider: CliAgent;
  index: number;
  chatId: string;
  title: string;
  cwd: string;
} | null {
  const provider = detectCliAgent(command);
  if (!provider || existingAgentTabCount >= 12) return null;
  const index = existingAgentTabCount + 1;
  return {
    provider,
    index,
    chatId: `${workspace.id}:chat:${index}`,
    title: `${workspace.name} · ${index}`,
    cwd: workspace.workingFolder ?? "",
  };
}

export function appendAgentWorkspaceTerminal(
  workspace: WorkspaceRecord,
  tabId: number,
  provider: CliAgent,
  chatId: string,
  count: number,
  updatedAt = Date.now(),
): WorkspaceRecord {
  return {
    ...workspace,
    tabId: workspace.tabId ?? tabId,
    agentTabIds: [...(workspace.agentTabIds ?? []), tabId],
    agentProviders: [...(workspace.agentProviders ?? []), provider],
    agentSessionIds: [...(workspace.agentSessionIds ?? []), null],
    agentChatIds: [...(workspace.agentChatIds ?? []), chatId],
    count,
    updatedAt,
  };
}

export function updateWorkspaceAgentSessionIdentity(
  workspace: WorkspaceRecord,
  tabId: number,
  chatId: string,
  provider: CliAgent,
  nativeSessionId: string,
  updatedAt: number,
): WorkspaceRecord {
  const tabIndex =
    workspace.agentChatIds?.indexOf(chatId) ??
    workspace.agentTabIds?.indexOf(tabId) ??
    -1;
  const agentProviders = [...(workspace.agentProviders ?? [])];
  if (tabIndex >= 0) agentProviders[tabIndex] = provider;
  const agentSessionIds = [...(workspace.agentSessionIds ?? [])];
  if (tabIndex >= 0) agentSessionIds[tabIndex] = nativeSessionId;
  else if (agentSessionIds.length === 0) agentSessionIds[0] = nativeSessionId;

  return {
    ...workspace,
    agentSessionId: nativeSessionId,
    agentProviders,
    agentSessionIds,
    updatedAt,
  };
}

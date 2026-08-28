import { invoke } from "@tauri-apps/api/core";
import { currentWorkspaceEnv } from "@/modules/workspace";

export type AgentRateLimit = {
  label: string;
  usedPercent: number;
  windowMinutes?: number;
  resetsAt?: number;
};

export type AgentUsageStatus = {
  provider: "codex" | "claude";
  contextWindow?: number;
  contextTokens?: number;
  contextRemainingPercent?: number;
  contextIsEstimated: boolean;
  rateLimits: AgentRateLimit[];
};

export const traceTerminalInput = (source: string, data: string): Promise<void> =>
  invoke("pty_trace_input", { source, data });

export const getAgentUsageStatuses = (
  cwd: string,
  provider?: string,
  nativeSessionId?: string | null,
): Promise<AgentUsageStatus[]> =>
  invoke("agent_usage_statuses", { cwd, provider, nativeSessionId });

export const listTerminalSubdirectories = (
  path: string,
  showHidden: boolean,
): Promise<string[]> =>
  invoke("list_subdirs", { path, showHidden, workspace: currentWorkspaceEnv() });

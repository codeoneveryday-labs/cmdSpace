import { invoke } from "@tauri-apps/api/core";
import { currentWorkspaceEnv } from "@/modules/workspace";

export type AgentRateLimit = {
  label: string;
  usedPercent: number;
  windowMinutes?: number;
  resetsAt?: number;
};

export type AgentUsageStatus = {
  provider: "codex" | "claude" | "omp" | "cmd" | "opencode";
  nativeSessionId?: string;
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
  sessionTitleHint?: string | null,
  sessionStartedAtMs?: number,
): Promise<AgentUsageStatus[]> =>
  invoke("agent_usage_statuses", {
    cwd,
    provider,
    nativeSessionId,
    sessionTitleHint,
    sessionStartedAtMs,
  });

export const listTerminalSubdirectories = (
  path: string,
  showHidden: boolean,
): Promise<string[]> =>
  invoke("list_subdirs", { path, showHidden, workspace: currentWorkspaceEnv() });

import {
  filterImportableSessions,
  sessionProviderCounts,
  sessionsForEnabledProviders,
  type AgentSessionProvider,
  type ImportableAgentSession,
} from "./importSessions";

export type ImportSessionScope = "workspace" | "all";
export type ImportSessionProviderFilter = AgentSessionProvider | "all";

type ImportSessionDialogModelInput = {
  sessions: readonly ImportableAgentSession[];
  enabledProviders: readonly AgentSessionProvider[];
  workspaceCwd: string | null;
  scope: ImportSessionScope;
  provider: ImportSessionProviderFilter;
  query: string;
  selectedSessionKeys: ReadonlySet<string>;
};

export type ImportSessionDialogModel = {
  provider: ImportSessionProviderFilter;
  providerOptions: Array<{ provider: AgentSessionProvider; count: number }>;
  visibleSessions: ImportableAgentSession[];
  selectedSessions: ImportableAgentSession[];
  selectedSessionLabel: "session" | "sessions";
};

export function importSessionKey(session: {
  provider: AgentSessionProvider;
  sessionId: string;
}): string {
  return `${session.provider}:${session.sessionId}`;
}

export function deriveImportSessionDialogModel(
  input: ImportSessionDialogModelInput,
): ImportSessionDialogModel {
  const enabledSessions = sessionsForEnabledProviders(
    input.sessions,
    input.enabledProviders,
  );
  const provider =
    input.provider !== "all" && !input.enabledProviders.includes(input.provider)
      ? "all"
      : input.provider;
  const scopedSessions = filterImportableSessions(
    enabledSessions,
    input.workspaceCwd,
    input.scope,
    "all",
    "",
  );
  const providerOptions = sessionProviderCounts(
    scopedSessions,
    input.enabledProviders,
  );
  const visibleSessions = filterImportableSessions(
    enabledSessions,
    input.workspaceCwd,
    input.scope,
    provider,
    input.query,
  );
  const selectedSessions = enabledSessions.filter((session) =>
    input.selectedSessionKeys.has(importSessionKey(session)),
  );

  return {
    provider,
    providerOptions,
    visibleSessions,
    selectedSessions,
    selectedSessionLabel: selectedSessions.length === 1 ? "session" : "sessions",
  };
}

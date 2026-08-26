import {
  CLI_AGENT_BY_ID,
  detectCliAgent,
  type CliAgent,
} from "@/modules/terminal/lib/cliAgents";

export type AgentSessionProvider = CliAgent;

export type ImportableAgentSession = {
  provider: AgentSessionProvider;
  sessionId: string;
  cwd: string;
  title: string;
  preview?: string | null;
  lastActivityAt: number;
  active: boolean;
};

export type ResumableWorkspacePane = {
  paneIndex: number;
  workingFolder: string | null;
  autoLaunch: boolean;
  lastCommand: string | null;
  agentProvider?: AgentSessionProvider | null;
  nativeSessionId?: string | null;
};

function quoteShellArgument(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function buildSessionResumeCommand(
  provider: AgentSessionProvider,
  sessionId: string,
): string {
  const id = quoteShellArgument(sessionId);
  switch (provider) {
    case "claude":
      return `claude --resume ${id}`;
    case "codex":
      return `codex resume ${id}`;
    case "gemini":
      return `gemini --resume ${id}`;
    case "opencode":
      return `opencode --session ${id}`;
    case "copilot":
      return `copilot --resume=${id}`;
    case "cursor":
      return `cursor-agent --resume ${id}`;
    case "aider":
      return `aider --restore-chat-history --chat-history-file ${id}`;
    case "pi":
      return `pi --session ${id}`;
    case "amp":
      return `amp threads continue ${id}`;
    case "cline":
      return `cline --taskId ${id}`;
    case "goose":
      return `goose session --resume --session-id ${id}`;
    case "qwen":
      return `qwen --resume ${id}`;
    case "kimi":
      return `kimi --session ${id}`;
    case "openhands":
      return `openhands --resume ${id}`;
    case "kiro":
      return `kiro-cli chat --resume-id ${id}`;
    case "grok":
      return `grok --resume ${id}`;
    case "herdr":
      return `herdr session attach ${id}`;
    case "cmd":
      return `cmd --session ${id}`;
    default:
      // Marketplace agents do not share one resume API. Keep imported
      // sessions usable with a conservative conventional fallback until an
      // agent-specific resume command is known.
      return `${CLI_AGENT_BY_ID[provider].executable} --resume ${id}`;
  }
}

export function regularTerminalCount(
  total: number,
  imported: number,
  cli: number,
): number {
  return Math.max(0, total - imported - cli);
}

export function formatRelativeActivity(
  timestamp: number,
  now: number = Date.now(),
): string {
  if (!timestamp) return "Unknown activity";
  const elapsed = Math.max(0, now - timestamp);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function normalizedPath(path: string): string {
  const normalized = path.replace(/[\\/]+$/, "");
  return normalized || path;
}

export function isResumeCommand(command?: string | null): boolean {
  return command !== undefined && command !== null
    ? /\b(?:resume|restore|continue|attach|session)\b/i.test(command)
    : false;
}

export function sessionIdFromResumeCommand(command?: string | null): string | null {
  if (!isResumeCommand(command)) return null;
  const match = command?.match(/(?:resume|restore|continue|attach|session)(?:=|\s+)(?:[^\s]+\s+)?['"]?([^'"\s]+)['"]?\s*$/i);
  return match?.[1] ?? null;
}

export function isSessionInWorkspace(
  session: ImportableAgentSession,
  workspaceCwd: string | null,
): boolean {
  return (
    workspaceCwd !== null &&
    normalizedPath(session.cwd) === normalizedPath(workspaceCwd)
  );
}

export function sessionsForWorkspace(
  sessions: ImportableAgentSession[],
  workspaceCwd: string | null,
): ImportableAgentSession[] {
  const cwd = workspaceCwd ? normalizedPath(workspaceCwd) : null;
  return [...sessions].sort((left, right) => {
    const leftMatches = cwd !== null && normalizedPath(left.cwd) === cwd;
    const rightMatches = cwd !== null && normalizedPath(right.cwd) === cwd;
    if (leftMatches !== rightMatches) return leftMatches ? -1 : 1;
    return right.lastActivityAt - left.lastActivityAt;
  });
}

export function sessionProviderCounts(
  sessions: readonly ImportableAgentSession[],
  providers: readonly AgentSessionProvider[],
): Array<{ provider: AgentSessionProvider; count: number }> {
  const counts = new Map<AgentSessionProvider, number>();
  for (const session of sessions) {
    counts.set(session.provider, (counts.get(session.provider) ?? 0) + 1);
  }
  return providers.map((provider) => ({
    provider,
    count: counts.get(provider) ?? 0,
  }));
}

export function sessionsForEnabledProviders(
  sessions: readonly ImportableAgentSession[],
  providers: readonly AgentSessionProvider[],
): ImportableAgentSession[] {
  const enabled = new Set(providers);
  return sessions.filter((session) => enabled.has(session.provider));
}

export function assignSessionsToPanes(
  panes: readonly ResumableWorkspacePane[],
  sessions: readonly ImportableAgentSession[],
  workspaceCwd: string | null,
  claimedSessionIds: readonly string[] = [],
  minimumActivityAtByPane: ReadonlyMap<number, number> = new Map(),
): ResumableWorkspacePane[] {
  const normalizedWorkspaceCwd = workspaceCwd ? normalizedPath(workspaceCwd) : null;
  const claimed = new Set(claimedSessionIds.filter(Boolean));
  const next = panes.map((pane) => ({ ...pane }));
  const groups = new Map<AgentSessionProvider, ResumableWorkspacePane[]>();
  const sessionsById = new Map(sessions.map((session) => [session.sessionId, session]));

  for (const pane of next) {
    if (!pane.nativeSessionId && isResumeCommand(pane.lastCommand)) {
      pane.nativeSessionId = sessionIdFromResumeCommand(pane.lastCommand);
      pane.agentProvider = pane.agentProvider ?? detectCliAgent(pane.lastCommand ?? undefined);
    }
    if (pane.nativeSessionId) {
      if (claimed.has(pane.nativeSessionId)) {
        // A stale duplicate mapping must not survive a second workspace
        // restore; clear it so this pane can claim an unclaimed session.
        const provider = pane.agentProvider ?? detectCliAgent(pane.lastCommand ?? undefined);
        pane.nativeSessionId = null;
        pane.agentProvider = provider;
        pane.lastCommand = provider ? CLI_AGENT_BY_ID[provider].launch : pane.lastCommand;
      } else {
      const persisted = sessionsById.get(pane.nativeSessionId);
      if (persisted?.active) {
        // A live native writer cannot be resumed. Leave this pane as a shell
        // rather than launching a second process that Codex will reject.
        pane.autoLaunch = false;
        pane.lastCommand = null;
        continue;
      }
      claimed.add(pane.nativeSessionId);
      }
    }
    if (!pane.autoLaunch || !pane.lastCommand || pane.nativeSessionId) continue;
    if (isResumeCommand(pane.lastCommand)) continue;
    const provider = detectCliAgent(pane.lastCommand);
    if (!provider) continue;
    pane.agentProvider = provider;
    const bucket = groups.get(provider) ?? [];
    bucket.push(pane);
    groups.set(provider, bucket);
  }

  for (const [provider, providerPanes] of groups) {
    const matches = sessions
      .filter((session) => {
        if (session.active) return false;
        if (session.provider !== provider) return false;
        if (claimed.has(session.sessionId)) return false;
        if (normalizedWorkspaceCwd === null) return true;
        return normalizedPath(session.cwd) === normalizedWorkspaceCwd;
      })
      .sort((left, right) => right.lastActivityAt - left.lastActivityAt);
    const panesByIndex = [...providerPanes].sort(
      (left, right) => left.paneIndex - right.paneIndex,
    );
    for (let index = 0; index < panesByIndex.length; index += 1) {
      const pane = panesByIndex[index];
      const minimumActivityAt = minimumActivityAtByPane.get(pane?.paneIndex ?? -1);
      const session = matches.find((candidate) =>
        !claimed.has(candidate.sessionId) &&
        (minimumActivityAt === undefined || candidate.lastActivityAt >= minimumActivityAt),
      );
      if (!pane || !session) continue;
      pane.agentProvider = provider;
      pane.nativeSessionId = session.sessionId;
      pane.lastCommand = buildSessionResumeCommand(provider, session.sessionId);
      claimed.add(session.sessionId);
    }
  }

  return next;
}

export function filterImportableSessions(
  sessions: readonly ImportableAgentSession[],
  workspaceCwd: string | null,
  scope: "workspace" | "all",
  provider: AgentSessionProvider | "all",
  query: string,
): ImportableAgentSession[] {
  const needle = query.trim().toLocaleLowerCase();
  return sessions.filter((session) => {
    if (
      scope === "workspace" &&
      !isSessionInWorkspace(session, workspaceCwd)
    ) {
      return false;
    }
    if (provider !== "all" && session.provider !== provider) return false;
    if (!needle) return true;
    return [session.provider, session.title, session.preview, session.cwd]
      .filter(Boolean)
      .some((value) => value!.toLocaleLowerCase().includes(needle));
  });
}

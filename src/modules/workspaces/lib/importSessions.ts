import {
  CLI_AGENT_BY_ID,
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

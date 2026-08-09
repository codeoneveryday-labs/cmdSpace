export type AgentSessionProvider = "claude" | "codex" | "opencode" | "pi";

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
    case "opencode":
      return `opencode --session ${id}`;
    case "pi":
      return `pi --session ${id}`;
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

import type { RemoteProtocolSession } from "../remoteClient";

function normalizeRemoteCwd(cwd: string): string {
  return cwd.replace(/\/+$/, "");
}

export function sessionsForRemoteCwd(
  sessions: RemoteProtocolSession[],
  remoteCwd: string | null,
): RemoteProtocolSession[] {
  if (!remoteCwd) return [];
  const normalizedCwd = normalizeRemoteCwd(remoteCwd);
  return sessions.filter(
    (session) =>
      session.cwd !== null && normalizeRemoteCwd(session.cwd) === normalizedCwd,
  );
}

export function visibleRemoteSession(
  sessions: RemoteProtocolSession[],
  activeSessionId: number | null,
): RemoteProtocolSession | undefined {
  return sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
}

export function shouldRetryRemoteSessionCreate(
  attempts: number,
  maxAttempts: number,
): boolean {
  return attempts < maxAttempts;
}

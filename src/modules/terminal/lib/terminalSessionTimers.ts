import type { TerminalSession } from "./terminalSessionModel";

export function clearTerminalSessionTimers(
  session: TerminalSession,
  clearTimeout: (id: number) => void,
): void {
  if (session.initialCommandFallbackTimer !== null) {
    clearTimeout(session.initialCommandFallbackTimer);
    session.initialCommandFallbackTimer = null;
  }
  if (session.agentActivityTimer !== null) {
    clearTimeout(session.agentActivityTimer);
    session.agentActivityTimer = null;
  }
  if (session.outputActivityTimer !== null) {
    clearTimeout(session.outputActivityTimer);
    session.outputActivityTimer = null;
  }
}

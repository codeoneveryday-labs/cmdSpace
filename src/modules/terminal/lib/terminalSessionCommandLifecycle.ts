import {
  setAgentCliCommand,
} from "./agentActivity";
import { isInteractiveCodingAgentCommand } from "./cliAgents";
import type { TerminalSession } from "./terminalSessionModel";

export function flushInitialCommand(
  leafId: number,
  session: TerminalSession,
): void {
  if (!session.pty || !session.initialCommand) return;
  const command = session.initialCommand;
  session.pty.write(command + "\r");
  if (isInteractiveCodingAgentCommand(command)) {
    setAgentCliCommand(leafId, command);
  }
  void session.pty.setMetadata({ agent: command });
  session.callbacks.onCommand?.(command);
  session.initialCommand = undefined;
  if (session.initialCommandFallbackTimer !== null) {
    window.clearTimeout(session.initialCommandFallbackTimer);
    session.initialCommandFallbackTimer = null;
  }
  if (session.agentActivityTimer !== null) {
    window.clearTimeout(session.agentActivityTimer);
    session.agentActivityTimer = null;
  }
  session.callbacks.onAgentActivity?.(false);
}

export function scheduleInitialCommandFallback(
  leafId: number,
  session: TerminalSession,
): void {
  if (!session.initialCommand || session.initialCommandFallbackTimer !== null) return;
  session.initialCommandFallbackTimer = window.setTimeout(() => {
    session.initialCommandFallbackTimer = null;
    flushInitialCommand(leafId, session);
  }, 900);
}

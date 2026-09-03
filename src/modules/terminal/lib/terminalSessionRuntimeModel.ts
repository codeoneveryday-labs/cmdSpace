import { DormantRing } from "./dormantRing";
import type { TerminalSession } from "./terminalSessionModel";

export type TerminalExitDisposition = "notify" | "defer" | "suppress";

export function resolveTerminalExitDisposition(
  respawning: boolean,
  hasExitCallback: boolean,
): TerminalExitDisposition {
  if (respawning) return "suppress";
  return hasExitCallback ? "notify" : "defer";
}

export function prepareTerminalSessionRespawn(
  session: TerminalSession,
  cwd: string | undefined,
  relaunchInitialCommand: boolean,
): void {
  if (cwd !== undefined) session.initialCwd = cwd;
  session.initialCommand = relaunchInitialCommand
    ? session.launchCommand
    : undefined;
  session.respawning = true;
  session.snapshot = null;
  session.dormantRing = new DormantRing();
  session.shellExited = false;
  session.pendingExit = null;
  session.altScreenAtRelease = false;
  session.inputBuffer = "";
  if (session.shellState) {
    session.shellState.inCommand = false;
    session.shellState.commandCount = 0;
  }
}

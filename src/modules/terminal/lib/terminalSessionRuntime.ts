import {
  clearPtyLeaf,
  setAgentBlockedActivity,
  setAgentCliCommand,
  setAgentResponseRequested,
  setAgentResponseActivity,
  setPtyLeaf,
} from "./agentActivity";
import { createShellIntegrationState, registerCwdHandler, registerPromptTracker } from "./osc-handlers";
import { openPty, type PtySession } from "./pty-bridge";
import { broadcastTargetsForInput } from "./terminalBroadcastRuntime";
import { noteTerminalOutput } from "./terminalActivity";
import { acquireSlot, configureRendererPool, getSlotForLeaf, releaseSlot, syncSlotThemeForLeaf } from "./rendererPool";
import { isInteractiveCodingAgentCommand, isDarkTerminalAgent, detectCliAgent } from "./cliAgents";
import { processTerminalOutput } from "./terminalOutputModel";
import { trackTerminalInput } from "./terminalInputTrackingModel";
import { installTerminalWakeRebind } from "./terminalWakeRebind";
import { createTerminalSession, type TerminalSession as Session, type TerminalSessionCallbacks as Callbacks } from "./terminalSessionModel";
import { clearTerminalSessionTimers } from "./terminalSessionTimers";
import {
  prepareTerminalSessionRespawn,
  resolveTerminalExitDisposition,
} from "./terminalSessionRuntimeModel";
import { flushInitialCommand } from "./terminalSessionCommandLifecycle";
import { waitForTerminalSessionReady } from "./terminalSessionReady";
import { resolveAgentOutputActivity } from "./terminalAgentOutputModel";
import { detachTerminalSession, unbindTerminalSessionFromSlot } from "./terminalSessionAttachment";

const OUTPUT_ACTIVITY_QUIET_MS = 900;

export const sessions = new Map<number, Session>();

installTerminalWakeRebind(() => {
  for (const [leafId, session] of sessions) {
    if (session.disposed || !session.visibleNow || session.hasSlot || !session.container) continue;
    bindLeafToSlot(leafId, session);
  }
});

function markAgentResponding(
  leafId: number,
  s: Session,
  markCompleted = true,
): void {
  setAgentResponseActivity(leafId, true);
  s.callbacks.onAgentActivity?.(true);
  if (s.agentActivityTimer !== null) window.clearTimeout(s.agentActivityTimer);
  s.agentActivityTimer = window.setTimeout(() => {
    s.agentActivityTimer = null;
    if (markCompleted) {
      setAgentResponseActivity(leafId, false, true);
      s.agentResponseRequested = false;
      s.callbacks.onAgentActivity?.(false);
    }
  }, OUTPUT_ACTIVITY_QUIET_MS);
}

function trackInputAndApplyEvents(leafId: number, s: Session, data: string): void {
  const result = trackTerminalInput(
    {
      inputBuffer: s.inputBuffer,
      agentLaunchBuffer: s.agentLaunchBuffer,
      interactiveCodingAgent: s.interactiveCodingAgent,
    },
    data,
    {
      inCommand: Boolean(s.shellState?.inCommand),
      isInteractiveCodingAgentCommand,
    },
  );
  s.inputBuffer = result.state.inputBuffer;
  s.agentLaunchBuffer = result.state.agentLaunchBuffer;
  s.interactiveCodingAgent = result.state.interactiveCodingAgent;

  for (const event of result.events) {
    if (event.type === "agent-response-requested") {
      s.agentResponseRequested = true;
      setAgentResponseRequested(leafId, true);
      markAgentResponding(leafId, s, false);
      continue;
    }

    if (event.interactive) {
      s.launchCommand = event.command;
      s.cliAgent = detectCliAgent(event.command);
      setAgentCliCommand(leafId, event.command);
      syncSlotThemeForLeaf(leafId);
    } else {
      setAgentResponseActivity(leafId, false, false);
      s.callbacks.onAgentActivity?.(false);
    }
    void s.pty?.setMetadata({ agent: event.command });
    s.callbacks.onCommand?.(event.command);
  }
}

export function writeToSessionPty(leafId: number, s: Session, data: string): void {
  s.lastLocalInputAt = Date.now();
  if (s.interactiveCodingAgent && /[\r\n]/.test(data)) {
    s.agentResponseRequested = true;
    setAgentResponseRequested(leafId, true);
    markAgentResponding(leafId, s, false);
  }
  s.pty?.write(data);
  trackInputAndApplyEvents(leafId, s, data);
}

function observeTerminalInputLine(
  leafId: number,
  s: Session,
  line: string,
): void {
  if (s.shellState?.inCommand || !isInteractiveCodingAgentCommand(line)) return;
  s.interactiveCodingAgent = true;
  s.launchCommand = line;
  s.cliAgent = detectCliAgent(line);
  setAgentCliCommand(leafId, line);
  syncSlotThemeForLeaf(leafId);
  void s.pty?.setMetadata({ agent: line });
  s.callbacks.onCommand?.(line);
}

configureRendererPool({
  resolveLeaf(leafId) {
    const s = sessions.get(leafId);
    if (!s) return null;
    return {
      writeToPty: (data) => {
        for (const targetLeafId of broadcastTargetsForInput(
          leafId,
          [...sessions.keys()],
        )) {
          const target = sessions.get(targetLeafId);
          if (target) writeToSessionPty(targetLeafId, target, data);
        }
      },
      isHerdr: () => s.cliAgent === "herdr",
      isDarkAgent: () => isDarkTerminalAgent(s.cliAgent),
      observeInputLine: (line) => {
        observeTerminalInputLine(leafId, s, line);
      },
      resizePty: (cols, rows) => {
        s.cols = cols;
        s.rows = rows;
        s.pty?.resize(cols, rows);
      },
      kickPty: (cols, rows) => {
        const pty = s.pty;
        if (!pty || cols <= 0 || rows <= 0) return;
        // Linux only emits SIGWINCH when the winsize ioctl actually
        // changes dims, so bump +1 row then restore. The TUI receives
        // (possibly two) SIGWINCHes and repaints from scratch.
        pty
          .resize(cols, rows + 1)
          .then(() => pty.resize(cols, rows))
          .catch((e) => console.warn("[cmdspace] kickPty failed:", e));
      },
    };
  },
  evictLeaf(leafId) {
    const s = sessions.get(leafId);
    if (!s) return;
    unbindTerminalSessionFromSlot(leafId, s, releaseSlot);
  },
  isLeafFocused(leafId) {
    const s = sessions.get(leafId);
    return !!s && s.visibleNow && s.focusedNow;
  },
});

export function ensureSession(
  leafId: number,
  initialCwd?: string,
  initialCommand?: string,
): Session {
  const existing = sessions.get(leafId);
  if (existing) return existing;

  const session = createTerminalSession(initialCwd, initialCommand);
  if (session.interactiveCodingAgent && initialCommand) {
    setAgentCliCommand(leafId, initialCommand);
  }
  sessions.set(leafId, session);

  session.ready = waitForTerminalSessionReady();

  return session;
}

function deliverPtyBytes(leafId: number, bytes: Uint8Array): void {
  const s = sessions.get(leafId);
  if (!s) return;
  const outputActivity = noteTerminalOutput(Date.now(), OUTPUT_ACTIVITY_QUIET_MS);
  s.callbacks.onOutputActivity?.(outputActivity.active);
  if (s.outputActivityTimer !== null) window.clearTimeout(s.outputActivityTimer);
  s.outputActivityTimer = window.setTimeout(() => {
    s.outputActivityTimer = null;
    s.callbacks.onOutputActivity?.(false);
  }, Math.max(0, outputActivity.expiresAt - Date.now()));
  const outputResult = processTerminalOutput(
    {
      agentOutputTail: s.agentOutputTail,
      interactiveCodingAgent: s.interactiveCodingAgent,
      launchCommand: s.launchCommand,
    },
    new TextDecoder().decode(bytes),
    Date.now(),
    s.lastLocalInputAt,
  );
  s.agentOutputTail = outputResult.state.agentOutputTail;
  s.interactiveCodingAgent = outputResult.state.interactiveCodingAgent;
  s.launchCommand = outputResult.state.launchCommand;
  if (outputResult.detectedAgent) {
    s.cliAgent = detectCliAgent(outputResult.detectedAgent);
    setAgentCliCommand(leafId, outputResult.detectedAgent);
    syncSlotThemeForLeaf(leafId);
    if (outputResult.agentStarted) {
      void s.pty?.setMetadata({ agent: outputResult.detectedAgent });
      s.callbacks.onCommand?.(outputResult.detectedAgent);
    }
  }
  const activity = resolveAgentOutputActivity({
    responseRequested: s.agentResponseRequested,
    spinnerState: outputResult.spinnerState,
    outputIsUserEcho: outputResult.outputIsUserEcho,
  });
  if (activity.kind === "blocked") {
    setAgentBlockedActivity(leafId, true);
    setAgentResponseActivity(leafId, false, false);
  } else if (
    activity.kind === "working" ||
    activity.kind === "quiet"
  ) {
    setAgentBlockedActivity(leafId, false);
    // Keep the response request latched while the CLI is still emitting its
    // own spinner. The quiet-output fallback may clear the visual state, but
    // it must not lose the in-flight request before the next spinner frame.
    markAgentResponding(leafId, s, activity.kind === "quiet");
  }
  const slot = getSlotForLeaf(leafId);
  if (slot) slot.term.write(bytes);
  else s.dormantRing.push(bytes);
}

async function openPtyForSession(
  leafId: number,
  s: Session,
  cwd: string | undefined,
): Promise<PtySession> {
  const startCols = s.cols > 0 ? s.cols : 80;
  const startRows = s.rows > 0 ? s.rows : 24;
  const pty = await openPty(
    startCols,
    startRows,
    {
      onData: (bytes) => deliverPtyBytes(leafId, bytes),
      onExit: (code) => {
        if (s.outputActivityTimer !== null) {
          window.clearTimeout(s.outputActivityTimer);
          s.outputActivityTimer = null;
        }
        s.callbacks.onOutputActivity?.(false);
        s.shellExited = true;
        s.pty = null;
        clearPtyLeaf(pty.id);
        const slot = getSlotForLeaf(leafId);
        if (slot) slot.term.options.disableStdin = true;
        const exitDisposition = resolveTerminalExitDisposition(
          s.respawning,
          Boolean(s.callbacks.onExit),
        );
        if (exitDisposition === "notify") s.callbacks.onExit?.(code);
        else if (exitDisposition === "defer") s.pendingExit = code;
      },
    },
    cwd,
    s.initialCommand,
  );
  setPtyLeaf(pty.id, leafId);
  return pty;
}

export function bindLeafToSlot(leafId: number, s: Session): void {
  if (!s.container) return;
  const altScreen = s.altScreenAtRelease;
  s.altScreenAtRelease = false;
  acquireSlot({
    leafId,
    container: s.container,
    snapshot: s.snapshot,
    altScreen,
    drainRing: (write) => s.dormantRing.drain(write),
    shellExited: s.shellExited,
    searchQuery: s.searchQuery,
    cols: s.cols,
    rows: s.rows,
    registerOsc: (term) => {
      // Shared in-command flag — see osc-handlers.ts. The prompt tracker
      // flips it on OSC 133 B/C/D/A; the cwd handler reads it to ignore OSC
      // 7 emitted by untrusted command output (remote SSH, `cat` of an
      // attacker file, etc.).
      const shellState = createShellIntegrationState();
      s.shellState = shellState;
      const prompt = registerPromptTracker(term, shellState, () => {
        const hadInitialCommand = Boolean(s.initialCommand);
        flushInitialCommand(leafId, s);
        if (hadInitialCommand) return;

        // Skip prompt cleanup on the initial shell startup prompt before any command has executed.
        if (shellState.commandCount === 0) return;

        if (s.agentResponseRequested && !s.interactiveCodingAgent) {
          s.agentResponseRequested = false;
          setAgentResponseActivity(leafId, false, true);
          s.callbacks.onAgentActivity?.(false);
        }

        if (s.interactiveCodingAgent || s.launchCommand) {
          s.interactiveCodingAgent = false;
          s.launchCommand = undefined;
          s.cliAgent = null;
          s.agentOutputTail = "";
          setAgentCliCommand(leafId, undefined);
          setAgentResponseActivity(leafId, false, false);
          setAgentBlockedActivity(leafId, false);
          syncSlotThemeForLeaf(leafId);
          void s.pty?.setMetadata({ agent: undefined });
          s.callbacks.onCommand?.("");
          s.callbacks.onAgentActivity?.(false);
        }
      });
      const cwd = registerCwdHandler(
        term,
        (next) => {
          if (s.lastCwd === next) return;
          s.lastCwd = next;
          void s.pty?.setMetadata({ cwd: next });
          s.callbacks.onCwd?.(next);
        },
        shellState,
      );
      return [prompt.dispose, cwd];
    },
    onSearchReady: (addon) => s.callbacks.onSearchReady?.(addon),
  });
  s.snapshot = null;
  s.hasSlot = true;
  if (s.lastCwd !== null) s.callbacks.onCwd?.(s.lastCwd);
  if (s.pendingExit !== null) {
    const code = s.pendingExit;
    s.pendingExit = null;
    s.callbacks.onExit?.(code);
  }
}

export function attachSession(
  leafId: number,
  container: HTMLDivElement,
  callbacks: Callbacks,
): void {
  const s = sessions.get(leafId);
  if (!s || s.disposed) return;
  s.callbacks = callbacks;
  s.container = container;

  if (s.visibleNow) bindLeafToSlot(leafId, s);

  if (!s.pty && !s.ptyOpening && !s.shellExited) {
    s.ptyOpening = true;
    openPtyForSession(leafId, s, s.initialCwd)
      .then((pty) => {
        s.ptyOpening = false;
        if (s.disposed) {
          pty.close();
          return;
        }
        s.pty = pty;
        if (s.initialCommand) {
          // The native PTY bootstrap already executed this command. Publish
          // it for workspace/session persistence without writing it again.
          s.callbacks.onCommand?.(s.initialCommand);
        }
        s.initialCommand = undefined;
        if (s.cols > 0 && s.rows > 0) pty.resize(s.cols, s.rows);
      })
      .catch((e) => {
        s.ptyOpening = false;
        console.error("[cmdspace] openPty failed:", e);
      });
  }
}

export function detachSession(leafId: number): void {
  const s = sessions.get(leafId);
  if (!s) return;
  detachTerminalSession({ leafId, session: s, releaseSlot });
}

export async function respawnSession(
  leafId: number,
  cwd?: string,
  relaunchInitialCommand = false,
): Promise<void> {
  const s = sessions.get(leafId);
  if (!s || s.disposed) return;
  prepareTerminalSessionRespawn(s, cwd, relaunchInitialCommand);
  setAgentResponseActivity(leafId, false, false);
  if (s.pty) clearPtyLeaf(s.pty.id);
  const previousPty = s.pty;
  s.pty = null;
  // Wait for the native process to release its PTY before re-opening. This
  // matters on Windows, where an immediate reuse can race the old process
  // and leave the new agent in the previous working directory.
  if (previousPty) await previousPty.close();
  clearTerminalSessionTimers(s, window.clearTimeout);
  s.callbacks.onOutputActivity?.(false);
  s.callbacks.onAgentActivity?.(false);

  const slot = getSlotForLeaf(leafId);
  if (slot) {
    slot.term.options.disableStdin = false;
    slot.term.clear();
    slot.term.reset();
  }

  s.ptyOpening = true;
  let pty: PtySession;
  try {
    pty = await openPtyForSession(leafId, s, cwd ?? s.initialCwd);
  } catch (e) {
    s.ptyOpening = false;
    s.respawning = false;
    console.error("[cmdspace] respawn openPty failed:", e);
    return;
  }
  s.ptyOpening = false;
  if (s.disposed) {
    s.respawning = false;
    pty.close();
    return;
  }
  s.pty = pty;
  if (s.initialCommand) {
    // The native PTY bootstrap already executed this command. Publish
    // it for workspace/session persistence without writing it again.
    s.callbacks.onCommand?.(s.initialCommand);
  }
  s.initialCommand = undefined;
  s.respawning = false;
  if (s.cols > 0 && s.rows > 0) pty.resize(s.cols, s.rows);
}

export async function replaceSessionCommand(
  leafId: number,
  cwd: string | undefined,
  command: string | null,
): Promise<void> {
  const session = sessions.get(leafId);
  if (!session || session.disposed || session.respawning) return;
  session.launchCommand = command ?? undefined;
  session.interactiveCodingAgent = Boolean(
    command && isInteractiveCodingAgentCommand(command),
  );
  session.cliAgent = command ? detectCliAgent(command) : null;
  session.agentResponseRequested = false;
  setAgentCliCommand(leafId, command ?? undefined);
  syncSlotThemeForLeaf(leafId);
  await respawnSession(leafId, cwd, Boolean(command));
}

export function disposeSession(leafId: number): void {
  const s = sessions.get(leafId);
  if (!s) return;
  s.disposed = true;
  setAgentResponseActivity(leafId, false, false);
  clearTerminalSessionTimers(s, window.clearTimeout);
  s.callbacks.onOutputActivity?.(false);
  s.callbacks.onAgentActivity?.(false);
  unbindTerminalSessionFromSlot(leafId, s, releaseSlot);
  s.snapshot = null;
  if (s.pty) clearPtyLeaf(s.pty.id);
  s.pty?.close();
  s.pty = null;
  sessions.delete(leafId);
}

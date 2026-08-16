import { ensureMonoFontsLoaded } from "@/lib/fonts";
import { usePreferencesStore } from "@/modules/settings/preferences";
import type { SearchAddon } from "@xterm/addon-search";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { DormantRing } from "./dormantRing";
import {
  clearPtyLeaf,
  ensureAgentActivityListener,
  setAgentCliCommand,
  setAgentResponseActivity,
  setPtyLeaf,
} from "./agentActivity";
import {
  createShellIntegrationState,
  registerCwdHandler,
  registerPromptTracker,
  type ShellIntegrationState,
} from "./osc-handlers";
import { openPty, type PtySession } from "./pty-bridge";
import { broadcastTargetsForInput } from "./terminalBroadcastRuntime";
import { noteTerminalOutput } from "./terminalActivity";
import {
  acquireSlot,
  applyBackgroundActive,
  applyFontFamily,
  applyFontSize,
  applyLetterSpacing,
  applyTheme as applyPoolTheme,
  applyScrollback,
  applyWebglPreference,
  applyZoomLevel,
  configureRendererPool,
  focusSlot,
  getSlotForLeaf,
  releaseSlot,
  setSlotFocused,
} from "./rendererPool";
import {
  detectCodingAgentBanner,
  isInteractiveCodingAgentCommand,
} from "./cliAgents";

type Callbacks = {
  onSearchReady?: (addon: SearchAddon) => void;
  onExit?: (code: number) => void;
  onCwd?: (cwd: string) => void;
  onCommand?: (cmd: string) => void;
  onAgentActivity?: (responding: boolean) => void;
  onOutputActivity?: (active: boolean) => void;
};

type Session = {
  pty: PtySession | null;
  ptyOpening: boolean;
  initialCwd: string | undefined;
  initialCommand: string | undefined;
  launchCommand: string | undefined;
  lastCwd: string | null;
  pendingExit: number | null;
  shellExited: boolean;
  callbacks: Callbacks;
  visibleNow: boolean;
  focusedNow: boolean;
  disposed: boolean;
  ready: Promise<void>;
  cols: number;
  rows: number;
  container: HTMLDivElement | null;
  snapshot: string | null;
  searchQuery: string | null;
  dormantRing: DormantRing;
  hasSlot: boolean;
  altScreenAtRelease: boolean;
  inputBuffer: string;
  agentLaunchBuffer: string;
  agentOutputTail: string;
  interactiveCodingAgent: boolean;
  shellState: ShellIntegrationState | null;
  initialCommandFallbackTimer: number | null;
  agentActivityTimer: number | null;
  outputActivityTimer: number | null;
  lastLocalInputAt: number;
  respawning: boolean;
};

const sessions = new Map<number, Session>();
const LOCAL_INPUT_ECHO_GRACE_MS = 180;
const FONT_READY_TIMEOUT_MS = 1500;
const OUTPUT_ACTIVITY_QUIET_MS = 900;

ensureAgentActivityListener();

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
    setAgentResponseActivity(leafId, false, markCompleted);
    s.callbacks.onAgentActivity?.(false);
  }, OUTPUT_ACTIVITY_QUIET_MS);
}

/**
 * Keep the shell's editable prompt in sync regardless of whether input comes
 * from xterm, a shortcut, or an imperative caller such as the voice agent.
 */
function trackPromptInput(leafId: number, s: Session, data: string): void {
  if (s.shellState?.inCommand) {
    trackAgentLaunchInput(leafId, s, data);
    return;
  }

  if (data.includes("\r") || data.includes("\n")) {
    const [beforeEnter = ""] = data.split(/[\r\n]+/);
    s.inputBuffer += beforeEnter;
    const command = s.inputBuffer.trim();
    if (command.length > 0) {
      s.interactiveCodingAgent = isInteractiveCodingAgentCommand(command);
      if (s.interactiveCodingAgent) {
        s.launchCommand = command;
        setAgentCliCommand(leafId, command);
        markAgentResponding(leafId, s, false);
      }
      if (!s.interactiveCodingAgent) {
        setAgentResponseActivity(leafId, false);
        s.callbacks.onAgentActivity?.(false);
      }
      void s.pty?.setMetadata({ agent: command });
      s.callbacks.onCommand?.(command);
    }
    s.inputBuffer = "";
    return;
  }

  for (let index = 0; index < data.length; index += 1) {
    const char = data[index];
    if (char === "\x7f" || char === "\b") {
      s.inputBuffer = s.inputBuffer.slice(0, -1);
    } else if (char === "\u0015" || char === "\u0003") {
      s.inputBuffer = "";
    } else if (char.charCodeAt(0) >= 32) {
      s.inputBuffer += char;
    }
  }
}

/**
 * Some zsh integrations emit OSC 133 C before the editable prompt. Preserve
 * agent detection in that case without treating arbitrary TUI input as shell
 * command history.
 */
function trackAgentLaunchInput(leafId: number, s: Session, data: string): void {
  if (data.includes("\r") || data.includes("\n")) {
    const [beforeEnter = ""] = data.split(/[\r\n]+/);
    const command = (s.agentLaunchBuffer + beforeEnter).trim();
    if (isInteractiveCodingAgentCommand(command)) {
      s.interactiveCodingAgent = true;
      s.launchCommand = command;
      setAgentCliCommand(leafId, command);
      void s.pty?.setMetadata({ agent: command });
      s.callbacks.onCommand?.(command);
    }
    s.agentLaunchBuffer = "";
    return;
  }

  for (let index = 0; index < data.length; index += 1) {
    const char = data[index];
    if (char === "\x7f" || char === "\b") {
      s.agentLaunchBuffer = s.agentLaunchBuffer.slice(0, -1);
    } else if (char === "\u0015" || char === "\u0003") {
      s.agentLaunchBuffer = "";
    } else if (char.charCodeAt(0) >= 32) {
      s.agentLaunchBuffer += char;
    }
  }
}

function writeToSessionPty(leafId: number, s: Session, data: string): void {
  s.lastLocalInputAt = Date.now();
  s.pty?.write(data);
  trackPromptInput(leafId, s, data);
}

function observeTerminalInputLine(
  leafId: number,
  s: Session,
  line: string,
): void {
  if (s.shellState?.inCommand || !isInteractiveCodingAgentCommand(line)) return;
  s.interactiveCodingAgent = true;
  s.launchCommand = line;
  setAgentCliCommand(leafId, line);
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
    unbindLeafFromSlot(leafId, s);
  },
  isLeafFocused(leafId) {
    const s = sessions.get(leafId);
    return !!s && s.visibleNow && s.focusedNow;
  },
});

function ensureSession(
  leafId: number,
  initialCwd?: string,
  initialCommand?: string,
): Session {
  const existing = sessions.get(leafId);
  if (existing) return existing;

  const session: Session = {
    pty: null,
    ptyOpening: false,
    initialCwd,
    initialCommand,
    launchCommand: initialCommand,
    lastCwd: null,
    pendingExit: null,
    shellExited: false,
    callbacks: {},
    visibleNow: false,
    focusedNow: false,
    disposed: false,
    ready: Promise.resolve(),
    cols: 0,
    rows: 0,
    container: null,
    snapshot: null,
    searchQuery: null,
    dormantRing: new DormantRing(),
    hasSlot: false,
    altScreenAtRelease: false,
    inputBuffer: "",
    agentLaunchBuffer: "",
    agentOutputTail: "",
    interactiveCodingAgent: isInteractiveCodingAgentCommand(initialCommand),
    shellState: null,
    initialCommandFallbackTimer: null,
    agentActivityTimer: null,
    outputActivityTimer: null,
    lastLocalInputAt: 0,
    respawning: false,
  };
  if (session.interactiveCodingAgent && initialCommand) {
    setAgentCliCommand(leafId, initialCommand);
  }
  sessions.set(leafId, session);

  session.ready = (async () => {
    // Race font readiness against a timeout: a stalled font load (e.g. slow
    // WebView2 on a Windows VM) must not block the first PTY spawn forever.
    const fontReady = (async () => {
      await ensureMonoFontsLoaded();
      await document.fonts.ready;
    })();
    await Promise.race([
      fontReady,
      new Promise((resolve) => setTimeout(resolve, FONT_READY_TIMEOUT_MS)),
    ]);
  })();

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
  const output = s.agentOutputTail + new TextDecoder().decode(bytes);
  s.agentOutputTail = output.slice(-512);
  const detectedAgent = detectCodingAgentBanner(output);
  if (detectedAgent) {
    const wasInteractiveCodingAgent = s.interactiveCodingAgent;
    s.interactiveCodingAgent = true;
    s.launchCommand = detectedAgent;
    setAgentCliCommand(leafId, detectedAgent);
    if (!wasInteractiveCodingAgent) {
      void s.pty?.setMetadata({ agent: detectedAgent });
      s.callbacks.onCommand?.(detectedAgent);
    }
  }
  const outputIsUserEcho = Date.now() - s.lastLocalInputAt < LOCAL_INPUT_ECHO_GRACE_MS;
  if (s.interactiveCodingAgent && !outputIsUserEcho) {
    markAgentResponding(leafId, s);
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
        if (!s.respawning && s.callbacks.onExit) s.callbacks.onExit(code);
        else if (!s.respawning) s.pendingExit = code;
      },
    },
    cwd,
  );
  setPtyLeaf(pty.id, leafId);
  return pty;
}

function flushInitialCommand(leafId: number, s: Session): void {
  if (!s.pty || !s.initialCommand) return;
  const command = s.initialCommand;
  s.pty.write(command + "\r");
  // Initial commands bypass normal keyboard input, so publish them explicitly.
  // The pane chrome uses this metadata to identify coding CLIs such as Codex.
  if (isInteractiveCodingAgentCommand(command)) {
    setAgentCliCommand(leafId, command);
  }
  void s.pty.setMetadata({ agent: command });
  s.callbacks.onCommand?.(command);
  s.initialCommand = undefined;
  if (s.initialCommandFallbackTimer !== null) {
    window.clearTimeout(s.initialCommandFallbackTimer);
    s.initialCommandFallbackTimer = null;
  }
  if (s.agentActivityTimer !== null) {
    window.clearTimeout(s.agentActivityTimer);
    s.agentActivityTimer = null;
  }
  s.callbacks.onAgentActivity?.(false);
}

function scheduleInitialCommandFallback(leafId: number, s: Session): void {
  if (!s.initialCommand || s.initialCommandFallbackTimer !== null) return;
  s.initialCommandFallbackTimer = window.setTimeout(() => {
    s.initialCommandFallbackTimer = null;
    flushInitialCommand(leafId, s);
  }, 900);
}

function bindLeafToSlot(leafId: number, s: Session): void {
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
        flushInitialCommand(leafId, s);
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

function unbindLeafFromSlot(leafId: number, s: Session): void {
  if (!s.hasSlot) return;
  const out = releaseSlot(leafId);
  if (out) {
    s.snapshot = out.snapshot;
    if (out.cols > 0) s.cols = out.cols;
    if (out.rows > 0) s.rows = out.rows;
    s.altScreenAtRelease = out.altScreen;
  }
  s.hasSlot = false;
  s.shellState = null;
}

function attachSession(
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
        if (s.cols > 0 && s.rows > 0) pty.resize(s.cols, s.rows);
        scheduleInitialCommandFallback(leafId, s);
      })
      .catch((e) => {
        s.ptyOpening = false;
        console.error("[cmdspace] openPty failed:", e);
      });
  }
}

function detachSession(leafId: number): void {
  const s = sessions.get(leafId);
  if (!s) return;
  unbindLeafFromSlot(leafId, s);
  s.visibleNow = false;
  s.focusedNow = false;
  s.callbacks = {};
  s.container = null;
}

export async function respawnSession(
  leafId: number,
  cwd?: string,
  relaunchInitialCommand = false,
): Promise<void> {
  const s = sessions.get(leafId);
  if (!s || s.disposed) return;
  if (cwd !== undefined) s.initialCwd = cwd;
  s.initialCommand = relaunchInitialCommand ? s.launchCommand : undefined;
  s.respawning = true;
  setAgentResponseActivity(leafId, false);
  if (s.pty) clearPtyLeaf(s.pty.id);
  const previousPty = s.pty;
  s.pty = null;
  // Wait for the native process to release its PTY before re-opening. This
  // matters on Windows, where an immediate reuse can race the old process
  // and leave the new agent in the previous working directory.
  if (previousPty) await previousPty.close();
  s.snapshot = null;
  s.dormantRing = new DormantRing();
  s.shellExited = false;
  s.pendingExit = null;
  s.altScreenAtRelease = false;
  s.inputBuffer = "";
  if (s.initialCommandFallbackTimer !== null) {
    window.clearTimeout(s.initialCommandFallbackTimer);
    s.initialCommandFallbackTimer = null;
  }
  if (s.agentActivityTimer !== null) {
    window.clearTimeout(s.agentActivityTimer);
    s.agentActivityTimer = null;
  }
  if (s.outputActivityTimer !== null) {
    window.clearTimeout(s.outputActivityTimer);
    s.outputActivityTimer = null;
  }
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
  s.respawning = false;
  if (s.cols > 0 && s.rows > 0) pty.resize(s.cols, s.rows);
}

export function disposeSession(leafId: number): void {
  const s = sessions.get(leafId);
  if (!s) return;
  s.disposed = true;
  setAgentResponseActivity(leafId, false);
  if (s.initialCommandFallbackTimer !== null) {
    window.clearTimeout(s.initialCommandFallbackTimer);
    s.initialCommandFallbackTimer = null;
  }
  if (s.agentActivityTimer !== null) {
    window.clearTimeout(s.agentActivityTimer);
    s.agentActivityTimer = null;
  }
  if (s.outputActivityTimer !== null) {
    window.clearTimeout(s.outputActivityTimer);
    s.outputActivityTimer = null;
  }
  s.callbacks.onOutputActivity?.(false);
  s.callbacks.onAgentActivity?.(false);
  unbindLeafFromSlot(leafId, s);
  s.snapshot = null;
  if (s.pty) clearPtyLeaf(s.pty.id);
  s.pty?.close();
  s.pty = null;
  sessions.delete(leafId);
}

type Options = {
  leafId: number;
  container: React.RefObject<HTMLDivElement | null>;
  visible: boolean;
  focused?: boolean;
  initialCwd?: string;
  initialCommand?: string;
  onSearchReady?: (addon: SearchAddon) => void;
  onExit?: (code: number) => void;
  onCwd?: (cwd: string) => void;
  onCommand?: (cmd: string) => void;
  onAgentActivity?: (responding: boolean) => void;
  onOutputActivity?: (active: boolean) => void;
};

export function useTerminalSession({
  leafId,
  container,
  visible,
  focused = true,
  initialCwd,
  initialCommand,
  onSearchReady,
  onExit,
  onCwd,
  onCommand,
  onAgentActivity,
  onOutputActivity,
}: Options) {
  const cbRef = useRef({ onSearchReady, onExit, onCwd, onCommand, onAgentActivity, onOutputActivity });
  cbRef.current = { onSearchReady, onExit, onCwd, onCommand, onAgentActivity, onOutputActivity };

  useEffect(() => {
    let cancelled = false;
    const s = ensureSession(leafId, initialCwd, initialCommand);
    s.ready.then(() => {
      if (cancelled || s.disposed) return;
      const node = container.current;
      if (!node) return;
      attachSession(leafId, node, {
        onSearchReady: (a) => cbRef.current.onSearchReady?.(a),
        onExit: (c) => cbRef.current.onExit?.(c),
        onCwd: (c) => cbRef.current.onCwd?.(c),
        onCommand: (cmd) => cbRef.current.onCommand?.(cmd),
        onAgentActivity: (responding) => cbRef.current.onAgentActivity?.(responding),
        onOutputActivity: (active) => cbRef.current.onOutputActivity?.(active),
      });
      if (s.visibleNow && s.focusedNow) focusSlot(leafId);
    });
    return () => {
      cancelled = true;
      detachSession(leafId);
    };
  }, [leafId, container]);

  const fontSize = usePreferencesStore((p) => p.terminalFontSize);
  useEffect(() => {
    applyFontSize(Math.max(4, Math.round(fontSize)));
  }, [fontSize]);

  const fontFamily = usePreferencesStore((p) => p.terminalFontFamily);
  useEffect(() => {
    applyFontFamily(fontFamily);
  }, [fontFamily]);

  const letterSpacing = usePreferencesStore((p) => p.terminalLetterSpacing);
  useEffect(() => {
    applyLetterSpacing(letterSpacing);
  }, [letterSpacing]);

  const scrollback = usePreferencesStore((p) => p.terminalScrollback);
  useEffect(() => {
    applyScrollback(scrollback);
  }, [scrollback]);

  const zoomLevel = usePreferencesStore((p) => p.zoomLevel);
  useEffect(() => {
    applyZoomLevel(zoomLevel);
  }, [zoomLevel]);

  const webglPref = usePreferencesStore((p) => p.terminalWebglEnabled);
  useEffect(() => {
    applyWebglPreference(webglPref);
  }, [webglPref]);

  const bgActive = usePreferencesStore(
    (p) => p.backgroundKind === "image" && !!p.backgroundImageId,
  );
  useEffect(() => {
    applyBackgroundActive(bgActive);
  }, [bgActive]);

  useEffect(() => {
    const s = sessions.get(leafId);
    if (!s) return;
    s.visibleNow = visible;
    s.focusedNow = focused;
    if (visible) {
      if (s.container && !s.hasSlot) bindLeafToSlot(leafId, s);
      setSlotFocused(leafId, focused);
      if (focused) focusSlot(leafId);
    } else {
      setSlotFocused(leafId, false);
    }
  }, [leafId, visible, focused]);

  const write = useCallback((data: string) => {
    const s = sessions.get(leafId);
    if (s) writeToSessionPty(leafId, s, data);
  }, [leafId]);

  /**
   * Replace an untouched prompt draft. Returning false protects user edits and
   * commands already handed to an interactive program from being overwritten.
   */
  const replaceInput = useCallback(
    (expected: string, next: string): boolean => {
      const s = sessions.get(leafId);
      if (!s?.pty || s.shellState?.inCommand || s.inputBuffer !== expected) {
        return false;
      }
      if (expected.length > 0) writeToSessionPty(leafId, s, "\u0015");
      writeToSessionPty(leafId, s, next);
      return true;
    },
    [leafId],
  );

  /**
   * Replace the current shell prompt after an asynchronous producer finishes.
   * User input is intentionally replaced, but a command already running is
   * never overwritten.
   */
  const replaceCurrentInput = useCallback(
    (next: string): boolean => {
      const s = sessions.get(leafId);
      if (!s?.pty || (s.shellState?.inCommand && !s.interactiveCodingAgent)) {
        return false;
      }
      if (s.inputBuffer.length > 0) writeToSessionPty(leafId, s, "\u0015");
      writeToSessionPty(leafId, s, next);
      return true;
    },
    [leafId],
  );

  const focus = useCallback(() => focusSlot(leafId), [leafId]);

  const getBuffer = useCallback(
    (maxLines = 200): string | null => {
      const s = sessions.get(leafId);
      if (!s) return null;
      const slot = getSlotForLeaf(leafId);
      if (slot) {
        const buf = slot.term.buffer.active;
        const total = buf.length;
        const lines: string[] = [];
        const start = Math.max(0, total - maxLines);
        for (let i = start; i < total; i++) {
          lines.push(buf.getLine(i)?.translateToString(true) ?? "");
        }
        while (lines.length && lines[lines.length - 1] === "") lines.pop();
        return lines.join("\n");
      }
      if (!s.snapshot) return "";
      const plain = stripAnsi(s.snapshot);
      const lines = plain.split(/\r?\n/);
      const tail = lines.slice(-maxLines);
      while (tail.length && tail[tail.length - 1] === "") tail.pop();
      return tail.join("\n");
    },
    [leafId],
  );

  const getSelection = useCallback((): string | null => {
    const slot = getSlotForLeaf(leafId);
    const sel = slot?.term.getSelection() ?? "";
    return sel.length > 0 ? sel : null;
  }, [leafId]);

  const applyTheme = useCallback(() => {
    applyPoolTheme();
  }, []);

  return useMemo(
    () => ({
      write,
      replaceInput,
      replaceCurrentInput,
      focus,
      getBuffer,
      getSelection,
      applyTheme,
    }),
    [
      write,
      replaceInput,
      replaceCurrentInput,
      focus,
      getBuffer,
      getSelection,
      applyTheme,
    ],
  );
}

const ANSI_RE =
  /\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[()][AB012]|\x1b[78=>]|\x1bc|\x1b[NOP\]X^_]/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, "");
}

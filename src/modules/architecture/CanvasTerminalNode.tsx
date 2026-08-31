import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { invoke } from "@tauri-apps/api/core";
import { ensureMonoFontsLoaded } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/modules/settings/preferences";
import type {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useEffect, useRef, useState } from "react";
import {
  openPty,
  type PtyHandlers,
  type PtySession,
} from "@/modules/terminal/lib/pty-bridge";
import {
  createMacCompositionCommitFilter,
  IS_MAC_TEXT_INPUT_PLATFORM,
  normalizeMacTerminalInput,
} from "@/modules/terminal/lib/macImeBridge";
import {
  createShellIntegrationState,
  registerCwdHandler,
  registerPromptTracker,
} from "@/modules/terminal/lib/osc-handlers";
import { sharedTerminalOptions } from "@/modules/terminal/lib/terminalOptions";
import {
  detectCliAgent,
  type CliAgent,
  isInteractiveCodingAgentCommand,
} from "@/modules/terminal/lib/cliAgents";
import { processTerminalOutput } from "@/modules/terminal/lib/terminalOutputModel";
import { tailTerminalLines } from "@/modules/terminal/lib/terminalBufferModel";
import { useTheme } from "@/modules/theme";
import { CanvasTerminalHeader } from "./CanvasTerminalHeader";
import { installCanvasTerminalSelectionCopy } from "./lib/canvasTerminalSelectionCopy";
import {
  isDeletePreviousWord,
  isDeleteToEndOfLine,
  isTerminalCopy,
  isTerminalPaste,
} from "./canvasTerminalShortcuts";

type AgentResponseState = "idle" | "responding" | "completed";

const AGENT_RESPONSE_IDLE_MS = 900;

type Props = {
  terminalId: string;
  initialCwd?: string;
  initialCommand?: string;
  stackTabs: Array<{
    id: string;
    label: string;
    kind?: "terminal" | "browser";
    agent?: CliAgent | null;
  }>;
  activeTabId: string;
  visible: boolean;
  onActivate: () => void;
  onActivateTab: (terminalId: string) => void;
  onTabPointerDown: (
    terminalId: string,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onRequestCloseTab: (terminalId: string) => void;
  onAddTab: (initialCommand?: string) => void;
  onSplitRight: () => void;
  singleTerminalGroup: boolean;
  terminalGroupLocked: boolean;
  maximized: boolean;
  onToggleTerminalGroupLock: () => void;
  onToggleTerminalGroupMaximize: () => void;
  onRequestCloseTerminalGroup: () => void;
  onHeaderPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCwdChange: (cwd: string) => void;
  onInitialCommandChange?: (command: string) => void;
  onHandleChange?: (handle: CanvasTerminalHandle | null) => void;
  cornerClassName: string;
  resizePaused: boolean;
  panning: boolean;
  onCanvasPanStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCanvasPanMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCanvasPanEnd: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCanvasWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
};

export type CanvasTerminalHandle = {
  replaceCurrentInput: (next: string) => boolean;
  focus: () => void;
  getBuffer: (maxLines?: number) => string | null;
  close: () => void;
};

function isRejectedCwdError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes("cwd not accessible") ||
    message.includes("cwd is not a directory") ||
    message.includes("cwd is outside the authorized workspace")
  );
}

function copySelection(selection: string): Promise<void> {
	return navigator.clipboard.writeText(selection);
}

export function CanvasTerminalNode({
  terminalId,
  initialCwd,
  initialCommand,
  stackTabs,
  activeTabId,
  visible,
  onActivate,
  onActivateTab,
  onTabPointerDown,
  onRequestCloseTab,
  onAddTab,
  onSplitRight,
  singleTerminalGroup,
  terminalGroupLocked,
  maximized,
  onToggleTerminalGroupLock,
  onToggleTerminalGroupMaximize,
  onRequestCloseTerminalGroup,
  onHeaderPointerDown,
  onCwdChange,
  onInitialCommandChange,
  onHandleChange,
  cornerClassName,
  resizePaused,
  panning,
  onCanvasPanStart,
  onCanvasPanMove,
  onCanvasPanEnd,
  onCanvasWheel,
}: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<PtySession | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<(() => void) | null>(null);
  const shellStateRef = useRef(createShellIntegrationState());
  const promptInputRef = useRef("");
  const initialCwdRef = useRef(initialCwd);
  const initialCommandRef = useRef(initialCommand);
  const agentActivityTimerRef = useRef<number | null>(null);
  const agentOutputTailRef = useRef("");
  const lastLocalInputAtRef = useRef(0);
  const interactiveCodingAgentRef = useRef(
    isInteractiveCodingAgentCommand(initialCommand),
  );
  const cwdChangeRef = useRef(onCwdChange);
  const handleChangeRef = useRef(onHandleChange);
  const requestCloseTabRef = useRef(onRequestCloseTab);
  const resizePausedRef = useRef(resizePaused);
  const [cwd, setCwd] = useState(initialCwd);
  const [launchCommand, setLaunchCommand] = useState(initialCommand);
  const [agentResponseState, setAgentResponseState] =
    useState<AgentResponseState>("idle");
	const [copyBadgeVisible, setCopyBadgeVisible] = useState(false);
  const { resolvedMode, themeId, customThemes } = useTheme();
  const terminalFontFamily = usePreferencesStore((state) => state.terminalFontFamily);
  const terminalFontSize = usePreferencesStore((state) => state.terminalFontSize);
  const terminalLetterSpacing = usePreferencesStore((state) => state.terminalLetterSpacing);
  const terminalScrollback = usePreferencesStore((state) => state.terminalScrollback);
  const backgroundKind = usePreferencesStore((state) => state.backgroundKind);
  const backgroundImageId = usePreferencesStore((state) => state.backgroundImageId);
  const zoomLevel = usePreferencesStore((state) => state.zoomLevel);
  cwdChangeRef.current = onCwdChange;
  handleChangeRef.current = onHandleChange;
  requestCloseTabRef.current = onRequestCloseTab;
  const tabLabel = cwd ? cwd.replace(/\/$/, "").split("/").pop() || cwd : "Terminal";
  const [detectedAgent, setDetectedAgent] = useState(() => detectCliAgent(initialCommand));
  initialCommandRef.current = launchCommand;
  const rememberDetectedAgentCommand = (command: string) => {
    const nextAgent = detectCliAgent(command);
    if (!nextAgent) return null;
    setDetectedAgent(nextAgent);
    onInitialCommandChange?.(command);
    return nextAgent;
  };
  const trackPromptInput = (data: string) => {
    lastLocalInputAtRef.current = Date.now();
    if (shellStateRef.current.inCommand) return;

    if (data.includes("\r") || data.includes("\n")) {
      const [beforeEnter = ""] = data.split(/[\r\n]+/);
      promptInputRef.current += beforeEnter;
      const command = promptInputRef.current.trim();
      interactiveCodingAgentRef.current = isInteractiveCodingAgentCommand(command);
      rememberDetectedAgentCommand(command);
      promptInputRef.current = "";
      return;
    }

    for (let index = 0; index < data.length; index += 1) {
      const char = data[index];
      if (char === "\x7f" || char === "\b") {
        promptInputRef.current = promptInputRef.current.slice(0, -1);
      } else if (char === "\u0015" || char === "\u0003") {
        promptInputRef.current = "";
      } else if (char.charCodeAt(0) >= 32) {
        promptInputRef.current += char;
      }
    }
  };

  useEffect(() => {
    const handle: CanvasTerminalHandle = {
      replaceCurrentInput: (next) => {
        const session = sessionRef.current;
        if (
          !session ||
          (shellStateRef.current.inCommand &&
            !interactiveCodingAgentRef.current)
        ) {
          return false;
        }
        void session.write("\u0015");
        void session.write(next);
        return true;
      },
      focus: () => terminalRef.current?.focus(),
      close: () => requestCloseTabRef.current?.(terminalId),
      getBuffer: (maxLines = 200) => {
        const terminal = terminalRef.current;
        if (!terminal) return null;
        const buffer = terminal.buffer.active;
        const lines: string[] = [];
        const start = Math.max(0, buffer.length - maxLines);
        for (let index = start; index < buffer.length; index += 1) {
          lines.push(buffer.getLine(index)?.translateToString(true) ?? "");
        }
        return tailTerminalLines(lines, maxLines);
      },
    };
    handleChangeRef.current?.(handle);
    return () => handleChangeRef.current?.(null);
  }, []);

  useEffect(() => {
    resizePausedRef.current = resizePaused;
    if (!resizePaused) {
      requestAnimationFrame(() => fitRef.current?.());
    }
  }, [resizePaused]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let cancelled = false;
    let terminal: Terminal | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let fitFrame: number | null = null;
    let disposeSelectionCopy: (() => void) | null = null;
    let disposeCwdHandler: (() => void) | null = null;
    let disposePromptTracker: (() => void) | null = null;
    let disposeCompositionFocusListeners: (() => void) | null = null;
    const outputDecoder = new TextDecoder();

    const trackAgentResponse = (bytes: Uint8Array) => {
      const result = processTerminalOutput(
        {
          agentOutputTail: agentOutputTailRef.current,
          interactiveCodingAgent: interactiveCodingAgentRef.current,
          launchCommand: undefined,
        },
        outputDecoder.decode(bytes),
        Date.now(),
        lastLocalInputAtRef.current,
      );
      agentOutputTailRef.current = result.state.agentOutputTail;
      interactiveCodingAgentRef.current = result.state.interactiveCodingAgent;
      if (!interactiveCodingAgentRef.current || result.outputIsUserEcho) return;

      setAgentResponseState("responding");
      if (agentActivityTimerRef.current !== null) {
        window.clearTimeout(agentActivityTimerRef.current);
      }
      agentActivityTimerRef.current = window.setTimeout(() => {
        agentActivityTimerRef.current = null;
        setAgentResponseState("completed");
      }, AGENT_RESPONSE_IDLE_MS);
    };

    void (async () => {
      await ensureMonoFontsLoaded();
      if (cancelled) return;

      terminal = new Terminal({ convertEol: true, ...sharedTerminalOptions() });
      terminalRef.current = terminal;
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(viewport);
      const compositionCommitFilter = createMacCompositionCommitFilter();
      if (IS_MAC_TEXT_INPUT_PLATFORM) {
        terminal.textarea?.addEventListener(
          "compositionend",
          compositionCommitFilter.beginCompositionFinalization,
        );
        const ownerWindow = viewport.ownerDocument.defaultView;
        ownerWindow?.addEventListener(
          "blur",
          compositionCommitFilter.handleWindowBlur,
        );
        ownerWindow?.addEventListener(
          "focus",
          compositionCommitFilter.handleWindowFocus,
        );
        disposeCompositionFocusListeners = () => {
          ownerWindow?.removeEventListener(
            "blur",
            compositionCommitFilter.handleWindowBlur,
          );
          ownerWindow?.removeEventListener(
            "focus",
            compositionCommitFilter.handleWindowFocus,
          );
        };
      }
      const shellState = createShellIntegrationState();
      shellStateRef.current = shellState;
      const promptTracker = registerPromptTracker(terminal, shellState);
      disposePromptTracker = promptTracker.dispose;
      disposeCwdHandler = registerCwdHandler(
        terminal,
        (nextCwd) => {
          setCwd(nextCwd);
          cwdChangeRef.current(nextCwd);
          void sessionRef.current?.setMetadata({ cwd: nextCwd });
        },
        shellState,
      );
      const fit = () => {
        try {
          fitAddon.fit();
        } catch {
          // The terminal can briefly be hidden while its canvas tab is inactive.
        }
      };
      const scheduleFit = () => {
        if (resizePausedRef.current || fitFrame !== null) return;
        fitFrame = requestAnimationFrame(() => {
          fitFrame = null;
          if (resizePausedRef.current) return;
          fit();
        });
      };
      fitRef.current = fit;
      resizeObserver = new ResizeObserver(scheduleFit);
      resizeObserver.observe(viewport);
      scheduleFit();
      terminal.attachCustomKeyEventHandler((event) => {
        if (isTerminalCopy(event)) {
          if (event.type === "keydown" && terminal?.hasSelection()) {
            const selection = terminal.getSelection();
			if (selection) void copySelection(selection).catch(() => {});
          }
          event.preventDefault();
          return false;
        }
        if (isTerminalPaste(event)) {
          if (event.type === "keydown") {
            void navigator.clipboard
              .readText()
              .then((text) => {
                if (!text) return;
                // WebKit on macOS can surface space characters in clipboard
                // content as invisible C1 control chars (U+0080–U+009F),
                // causing pasted words to fuse into a single token at the
                // shell. Normalize before forwarding to the PTY.
                const normalized = IS_MAC_TEXT_INPUT_PLATFORM
                  ? normalizeMacTerminalInput(text)
                  : text;
                trackPromptInput(normalized);
                void sessionRef.current?.write(normalized);
              })
              .catch(() => {});
          }
          event.preventDefault();
          return false;
        }
        if (isDeletePreviousWord(event)) {
          if (event.type === "keydown") {
            void sessionRef.current?.write("\x17");
          }
          event.preventDefault();
          return false;
        }
        if (isDeleteToEndOfLine(event)) {
          if (event.type === "keydown") {
            void sessionRef.current?.write("\x0b");
          }
          event.preventDefault();
          return false;
        }
        if (event.isComposing || event.keyCode === 229 || event.key === "Process") {
          if (event.type === "keydown" && event.metaKey) {
            compositionCommitFilter.beginKeydownFinalization();
          }
          return true;
        }
        return true;
      });
      disposeSelectionCopy = installCanvasTerminalSelectionCopy(
        terminal,
        copySelection,
        setCopyBadgeVisible,
      );
      terminal.onData((data) => {
        const normalized = IS_MAC_TEXT_INPUT_PLATFORM
          ? normalizeMacTerminalInput(data)
          : data;
        if (!compositionCommitFilter.shouldForward(normalized)) return;
        trackPromptInput(normalized);
        void invoke("pty_trace_input", {
          source: "canvas-xterm-ondata",
          data: normalized,
        });
        void sessionRef.current?.write(normalized);
      });
      terminal.onResize(({ cols, rows }) =>
        void sessionRef.current?.resize(cols, rows),
      );

      try {
        const handlers: PtyHandlers = {
          onData: (bytes) => {
            trackAgentResponse(bytes);
            terminal?.write(bytes);
          },
          onExit: () => {
            if (terminal) terminal.options.disableStdin = true;
          },
        };
        let session: PtySession;
        try {
          session = await openPty(
            80,
            24,
            handlers,
            initialCwdRef.current,
            initialCommandRef.current,
          );
        } catch (error) {
          if (!initialCwdRef.current || !isRejectedCwdError(error)) throw error;
          console.warn(
            "[architecture] saved terminal cwd is unavailable; retrying from the workspace default",
          );
          session = await openPty(
            80,
            24,
            handlers,
            undefined,
            initialCommandRef.current,
          );
        }
        if (cancelled) {
          void session.close();
          return;
        }
        sessionRef.current = session;
        fit();
        // `fit()` may have run before the PTY existed. Reassert the final
        // xterm dimensions so full-screen CLIs reserve their composer/status
        // rows inside the Canvas viewport instead of below it.
        if (terminal) void session.resize(terminal.cols, terminal.rows);
      } catch (error) {
        console.error("[architecture] canvas terminal could not open:", error);
      }
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      disposeCwdHandler?.();
      disposePromptTracker?.();
      disposeCompositionFocusListeners?.();
      if (fitFrame !== null) cancelAnimationFrame(fitFrame);
      disposeSelectionCopy?.();
      if (agentActivityTimerRef.current !== null) {
        window.clearTimeout(agentActivityTimerRef.current);
        agentActivityTimerRef.current = null;
      }
      terminal?.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void session.close();
    };
  }, [launchCommand]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    Object.assign(terminal.options, sharedTerminalOptions());
    if (!resizePausedRef.current) fitRef.current?.();
  }, [
    backgroundImageId,
    backgroundKind,
    customThemes,
    resolvedMode,
    terminalFontFamily,
    terminalFontSize,
    terminalLetterSpacing,
    terminalScrollback,
    themeId,
    zoomLevel,
  ]);

  useEffect(() => {
    if (visible && !resizePausedRef.current) fitRef.current?.();
  }, [visible]);

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-none bg-[var(--terminal-background)]",
        agentResponseState === "completed"
          ? "shadow-[0_0_18px_rgba(16,185,129,0.55)]"
          : "shadow-[0_12px_36px_-14px_rgba(0,0,0,0.32)]",
        cornerClassName,
      )}
      onPointerDownCapture={(event) => {
        if (!panning) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        onCanvasPanStart(event);
      }}
      onPointerMoveCapture={(event) => {
        if (!panning) return;
        event.preventDefault();
        event.stopPropagation();
        onCanvasPanMove(event);
      }}
      onPointerUpCapture={(event) => {
        if (!panning) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        onCanvasPanEnd(event);
      }}
      onPointerCancelCapture={(event) => {
        if (!panning) return;
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        onCanvasPanEnd(event);
      }}
      onWheelCapture={(event) => {
        // Let ordinary two-finger scrolling reach xterm's scrollback. Canvas
        // gestures remain available in Pan mode and for pinch/modified zoom.
        if (!panning && !event.ctrlKey && !event.metaKey) return;
        event.preventDefault();
        event.stopPropagation();
        onCanvasWheel(event);
      }}
      onPointerDown={(event) => {
        onActivate();
        if (agentResponseState === "completed") {
          setAgentResponseState("idle");
        }
        const target = event.target as HTMLElement;
        const topBar = event.clientY - event.currentTarget.getBoundingClientRect().top < 28;
        if (topBar && !target.closest("button")) {
          onHeaderPointerDown(event);
          return;
        }
        terminalRef.current?.focus();
        event.stopPropagation();
      }}
    >
      <CanvasTerminalHeader
        stackTabs={stackTabs}
        activeTabId={activeTabId}
        tabLabel={tabLabel}
        detectedAgent={detectedAgent}
        agentResponseState={agentResponseState}
        onActivateTab={onActivateTab}
        onTabPointerDown={onTabPointerDown}
        onRequestCloseTab={onRequestCloseTab}
        onAgentCommandChange={(command) => {
          rememberDetectedAgentCommand(command);
          setLaunchCommand(command);
        }}
        onAddTab={onAddTab}
        onSplitRight={onSplitRight}
        singleTerminalGroup={singleTerminalGroup}
        terminalGroupLocked={terminalGroupLocked}
        maximized={maximized}
        onToggleTerminalGroupLock={onToggleTerminalGroupLock}
        onToggleTerminalGroupMaximize={onToggleTerminalGroupMaximize}
        onRequestCloseTerminalGroup={onRequestCloseTerminalGroup}
      />
      <div
        ref={viewportRef}
        className="cmdspace-terminal-viewport cmdspace-canvas-terminal-viewport min-h-0 min-w-0 flex-1 overflow-hidden"
      />
			<div
				className={cn(
					"cmdspace-terminal-copy-badge cmdspace-canvas-terminal-copy-badge",
					copyBadgeVisible && "is-visible",
				)}
				role="status"
				aria-live="polite"
			>
				Copied
			</div>
    </div>
  );
}

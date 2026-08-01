import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import {
  Add01Icon,
  Cancel01Icon,
  LockIcon,
  SquareUnlock01Icon,
  TerminalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
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
  attachMacImeBridge,
  shouldIgnoreMacPrintableTerminalData,
  shouldUseMacTextInputPath,
} from "@/modules/terminal/lib/macImeBridge";
import {
  createShellIntegrationState,
  registerCwdHandler,
  registerPromptTracker,
} from "@/modules/terminal/lib/osc-handlers";
import { sharedTerminalOptions } from "@/modules/terminal/lib/terminalOptions";
import { useTheme } from "@/modules/theme";

type Props = {
  initialCwd?: string;
  initialCommand?: string;
  stackTabs: Array<{ id: string; label: string }>;
  activeTabId: string;
  visible: boolean;
  onActivate: () => void;
  onActivateTab: (terminalId: string) => void;
  onRequestCloseTab: (terminalId: string) => void;
  onAddTab: () => void;
  onSplitRight: () => void;
  singleTerminalGroup: boolean;
  terminalGroupLocked: boolean;
  maximized: boolean;
  onToggleTerminalGroupLock: () => void;
  onToggleTerminalGroupMaximize: () => void;
  onRequestCloseTerminalGroup: () => void;
  onHeaderPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCwdChange: (cwd: string) => void;
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
};

function isRejectedCwdError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes("cwd not accessible") ||
    message.includes("cwd is not a directory") ||
    message.includes("cwd is outside the authorized workspace")
  );
}

function isInteractiveCodingAgentCommand(command?: string): boolean {
  if (!command) return false;
  return ["claude", "codex", "opencode", "gemini", "kimi", "grok"].some((agent) =>
    new RegExp(`(?:^|[;|&\\s])${agent}(?=\\s|$)`, "i").test(command),
  );
}

function isTerminalCopy(event: KeyboardEvent): boolean {
  const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);
  const hasCopyModifier = isMac
    ? event.metaKey && !event.ctrlKey && !event.altKey
    : event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
  return hasCopyModifier && (event.code === "KeyC" || event.key === "c" || event.key === "C");
}

function copySelection(selection: string): Promise<void> {
	return navigator.clipboard.writeText(selection);
}

export function CanvasTerminalNode({
  initialCwd,
  initialCommand,
  stackTabs,
  activeTabId,
  visible,
  onActivate,
  onActivateTab,
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
  const interactiveCodingAgentRef = useRef(
    isInteractiveCodingAgentCommand(initialCommand),
  );
  const cwdChangeRef = useRef(onCwdChange);
  const handleChangeRef = useRef(onHandleChange);
  const resizePausedRef = useRef(resizePaused);
  const [cwd, setCwd] = useState(initialCwd);
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
  const tabLabel = cwd ? cwd.replace(/\/$/, "").split("/").pop() || cwd : "Terminal";
  const trackPromptInput = (data: string) => {
    if (shellStateRef.current.inCommand) return;

    if (data.includes("\r") || data.includes("\n")) {
      const [beforeEnter = ""] = data.split(/[\r\n]+/);
      promptInputRef.current += beforeEnter;
      interactiveCodingAgentRef.current = isInteractiveCodingAgentCommand(
        promptInputRef.current.trim(),
      );
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
      getBuffer: (maxLines = 200) => {
        const terminal = terminalRef.current;
        if (!terminal) return null;
        const buffer = terminal.buffer.active;
        const lines: string[] = [];
        const start = Math.max(0, buffer.length - maxLines);
        for (let index = start; index < buffer.length; index += 1) {
          lines.push(buffer.getLine(index)?.translateToString(true) ?? "");
        }
        while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
        return lines.join("\n");
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
    let refreshFrame: number | null = null;
    let fitFrame: number | null = null;
		let copyOnSelectionTimer: ReturnType<typeof setTimeout> | null = null;
		let copyBadgeTimer: ReturnType<typeof setTimeout> | null = null;
		let lastAutoCopiedSelection = "";
    let disposeCwdHandler: (() => void) | null = null;
    let disposePromptTracker: (() => void) | null = null;

    void (async () => {
      await ensureMonoFontsLoaded();
      if (cancelled) return;

      terminal = new Terminal({ convertEol: true, ...sharedTerminalOptions() });
      terminalRef.current = terminal;
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.open(viewport);
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
      const scheduleRefresh = () => {
        if (refreshFrame !== null) return;
        refreshFrame = requestAnimationFrame(() => {
          refreshFrame = null;
          terminal?.refresh(0, Math.max(0, terminal.rows - 1));
        });
      };
      terminal.onWriteParsed(scheduleRefresh);
      attachMacImeBridge(terminal, (data) => {
        trackPromptInput(data);
        void sessionRef.current?.write(data);
      });

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
        if (event.isComposing || event.keyCode === 229 || event.key === "Process") {
          return true;
        }
        return !shouldUseMacTextInputPath(event);
      });
		terminal.onSelectionChange(() => {
			if (copyOnSelectionTimer) clearTimeout(copyOnSelectionTimer);
			copyOnSelectionTimer = setTimeout(() => {
				copyOnSelectionTimer = null;
				if (!usePreferencesStore.getState().terminalCopyOnSelection) return;
				const selection = terminal?.getSelection() ?? "";
				if (!selection) {
					lastAutoCopiedSelection = "";
					return;
				}
				if (selection === lastAutoCopiedSelection) return;

				lastAutoCopiedSelection = selection;
				void copySelection(selection)
					.then(() => {
						setCopyBadgeVisible(true);
						if (copyBadgeTimer) clearTimeout(copyBadgeTimer);
						copyBadgeTimer = setTimeout(() => {
							setCopyBadgeVisible(false);
							copyBadgeTimer = null;
						}, 1_200);
						terminal?.clearSelection();
					})
					.catch(() => {
						lastAutoCopiedSelection = "";
					});
			}, 120);
		});
      terminal.onData((data) => {
        if (shouldIgnoreMacPrintableTerminalData(data)) return;
        trackPromptInput(data);
        void sessionRef.current?.write(data);
      });
      terminal.onResize(({ cols, rows }) =>
        void sessionRef.current?.resize(cols, rows),
      );

      try {
        const handlers: PtyHandlers = {
          onData: (bytes) => {
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
      if (refreshFrame !== null) cancelAnimationFrame(refreshFrame);
      if (fitFrame !== null) cancelAnimationFrame(fitFrame);
      if (copyOnSelectionTimer) clearTimeout(copyOnSelectionTimer);
			if (copyBadgeTimer) clearTimeout(copyBadgeTimer);
      terminal?.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      const session = sessionRef.current;
      sessionRef.current = null;
      if (session) void session.close();
    };
  }, []);

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
        "relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-none bg-[var(--terminal-background)] shadow-[0_12px_36px_-14px_rgba(0,0,0,0.32)]",
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
      <div className="relative z-20 flex h-7 shrink-0 items-center gap-0.5 border-b border-border/60 bg-white/95 px-1 text-muted-foreground shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-300">
        <div
          role="tablist"
          aria-label="Canvas terminal tabs"
          className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
        >
          {stackTabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "flex max-w-52 shrink-0 items-center rounded-full py-0.5 pr-1 text-[11px] font-normal transition-colors",
                tab.id === activeTabId
                  ? "bg-muted text-foreground shadow-sm dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:hover:bg-zinc-800/70",
              )}
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab.id === activeTabId}
                className="flex min-w-0 items-center gap-1 px-2"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onActivateTab(tab.id);
                if (tab.id === activeTabId) {
                  onHeaderPointerDown(
                    event as unknown as ReactPointerEvent<HTMLDivElement>,
                  );
                }
              }}
              onClick={(event) => {
                event.stopPropagation();
                onActivateTab(tab.id);
              }}
              >
                <HugeiconsIcon
                  icon={TerminalIcon}
                  size={12}
                  strokeWidth={1.8}
                  className={cn(
                    "shrink-0",
                    tab.id === activeTabId && "text-emerald-500",
                  )}
                />
                <span className="truncate">
                  {tab.id === activeTabId ? tabLabel : tab.label}
                </span>
              </button>
              <button
                type="button"
                aria-label={`Close ${tab.label}`}
                title={`Close ${tab.label}`}
                className="grid size-4 shrink-0 place-items-center rounded-sm text-muted-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onRequestCloseTab(tab.id);
                }}
              >
                <HugeiconsIcon icon={Cancel01Icon} size={11} strokeWidth={1.8} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label="Add terminal tab"
            title="Add terminal tab"
            className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={onAddTab}
          >
            <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={1.8} />
          </button>
          <button
            type="button"
            aria-label="Split terminal right"
            title="Split terminal right"
            className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={onSplitRight}
          >
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
              <path d="M12 4v16" />
            </svg>
          </button>
          {singleTerminalGroup ? (
            <>
              <button
                type="button"
                aria-label={
                  terminalGroupLocked
                    ? "Unlock terminal group"
                    : "Lock terminal group"
                }
                title={
                  terminalGroupLocked
                    ? "Unlock terminal group"
                    : "Lock terminal group"
                }
                className={cn(
                  "grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
                  terminalGroupLocked && "text-primary hover:text-primary",
                )}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={onToggleTerminalGroupLock}
              >
                <HugeiconsIcon
                  icon={terminalGroupLocked ? LockIcon : SquareUnlock01Icon}
                  size={13}
                  strokeWidth={1.8}
                />
              </button>
              <button
                type="button"
                aria-label={
                  maximized
                    ? "Restore terminal group"
                    : "Maximize terminal group"
                }
                title={
                  maximized
                    ? "Restore terminal group"
                    : "Maximize terminal group"
                }
                className="grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={onToggleTerminalGroupMaximize}
              >
                {maximized ? (
                  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 14h6v6" />
                    <path d="M10 14l-6 6" />
                    <path d="M20 10h-6V4" />
                    <path d="M14 10l6-6" />
                  </svg>
                ) : (
                  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h6v6" />
                    <path d="M9 21H3v-6" />
                    <path d="M21 3l-7 7" />
                    <path d="M3 21l7-7" />
                  </svg>
                )}
              </button>
              <button
                type="button"
                aria-label="Close terminal group"
                title="Close terminal group"
                className="grid size-5 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/[0.08] hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-zinc-400 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={onRequestCloseTerminalGroup}
              >
                <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.8} />
              </button>
            </>
          ) : null}
        </div>
      </div>
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

import { ensureMonoFontsLoaded } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { useTheme } from "@/modules/theme";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  attachMacImeBridge,
  shouldIgnoreMacPrintableTerminalData,
  shouldUseMacTextInputPath,
} from "./lib/macImeBridge";
import {
  createShellIntegrationState,
  registerCwdHandler,
  registerPromptTracker,
} from "./lib/osc-handlers";
import { openPty, type PtyHandlers, type PtySession } from "./lib/pty-bridge";
import { sharedTerminalOptions } from "./lib/terminalOptions";
import { TerminalNavigationControls } from "./TerminalNavigationControls";

const DEFAULT_HEIGHT = 240;
const MIN_HEIGHT = 160;
const MAX_HEIGHT = 560;

export type BottomTerminalDrawerHandle = {
  focus: () => void;
};

type Props = {
  cwd?: string | null;
  onClose: () => void;
};

function isRejectedCwdError(error: unknown): boolean {
  const message = String(error);
  return (
    message.includes("cwd not accessible") ||
    message.includes("cwd is not a directory") ||
    message.includes("cwd is outside the authorized workspace")
  );
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export const BottomTerminalDrawer = forwardRef<BottomTerminalDrawerHandle, Props>(
  function BottomTerminalDrawer({ cwd: initialCwd, onClose }, ref) {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const sessionRef = useRef<PtySession | null>(null);
    const fitRef = useRef<(() => void) | null>(null);
    const initialCwdRef = useRef(initialCwd ?? undefined);
    const resizeRef = useRef<{
      pointerId: number;
      startY: number;
      startHeight: number;
    } | null>(null);
    const resizeFrameRef = useRef<number | null>(null);
    const pendingHeightRef = useRef<number | null>(null);
    const [cwd, setCwd] = useState(initialCwd ?? undefined);
    const [height, setHeight] = useState(DEFAULT_HEIGHT);
    const [resizing, setResizing] = useState(false);
    const { resolvedMode, themeId, customThemes } = useTheme();
    const terminalFontFamily = usePreferencesStore((state) => state.terminalFontFamily);
    const terminalFontSize = usePreferencesStore((state) => state.terminalFontSize);
    const terminalLetterSpacing = usePreferencesStore((state) => state.terminalLetterSpacing);
    const terminalScrollback = usePreferencesStore((state) => state.terminalScrollback);
    const backgroundKind = usePreferencesStore((state) => state.backgroundKind);
    const backgroundImageId = usePreferencesStore((state) => state.backgroundImageId);
    const zoomLevel = usePreferencesStore((state) => state.zoomLevel);

    useImperativeHandle(ref, () => ({
      focus: () => terminalRef.current?.focus(),
    }));

    useEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      let cancelled = false;
      let terminal: Terminal | null = null;
      let resizeObserver: ResizeObserver | null = null;
      let refreshFrame: number | null = null;
      let fitFrame: number | null = null;
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
        const promptTracker = registerPromptTracker(terminal, shellState);
        disposePromptTracker = promptTracker.dispose;
        disposeCwdHandler = registerCwdHandler(
          terminal,
          (nextCwd) => {
            setCwd(nextCwd);
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
        attachMacImeBridge(terminal, (data) => void sessionRef.current?.write(data));

        const fit = () => {
          try {
            fitAddon.fit();
          } catch {
            // The drawer can be measured while the app shell is transitioning.
          }
        };
        const scheduleFit = () => {
          if (fitFrame !== null) return;
          fitFrame = requestAnimationFrame(() => {
            fitFrame = null;
            fit();
          });
        };
        fitRef.current = fit;
        resizeObserver = new ResizeObserver(scheduleFit);
        resizeObserver.observe(viewport);
        scheduleFit();

        terminal.attachCustomKeyEventHandler((event) => {
          if (event.isComposing || event.keyCode === 229 || event.key === "Process") {
            return true;
          }
          return !shouldUseMacTextInputPath(event);
        });
        terminal.onData((data) => {
          if (shouldIgnoreMacPrintableTerminalData(data)) return;
          void sessionRef.current?.write(data);
        });
        terminal.onResize(({ cols, rows }) => void sessionRef.current?.resize(cols, rows));

        const handlers: PtyHandlers = {
          onData: (bytes) => terminal?.write(bytes),
          onExit: () => {
            if (terminal) terminal.options.disableStdin = true;
          },
        };

        let session: PtySession;
        try {
          session = await openPty(80, 24, handlers, initialCwdRef.current);
        } catch (error) {
          if (!initialCwdRef.current || !isRejectedCwdError(error)) throw error;
          console.warn(
            "[terminal] bottom drawer cwd is unavailable; retrying from the default shell directory",
          );
          session = await openPty(80, 24, handlers);
        }
        if (cancelled) {
          void session.close();
          return;
        }
        sessionRef.current = session;
        fit();
      })().catch((error) => {
        console.error("[terminal] bottom drawer could not open:", error);
      });

      return () => {
        cancelled = true;
        resizeObserver?.disconnect();
        disposeCwdHandler?.();
        disposePromptTracker?.();
        if (refreshFrame !== null) cancelAnimationFrame(refreshFrame);
        if (fitFrame !== null) cancelAnimationFrame(fitFrame);
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
      fitRef.current?.();
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
      return () => {
        if (resizeFrameRef.current !== null) {
          cancelAnimationFrame(resizeFrameRef.current);
        }
      };
    }, []);

    const flushResize = () => {
      resizeFrameRef.current = null;
      const nextHeight = pendingHeightRef.current;
      pendingHeightRef.current = null;
      if (nextHeight !== null) setHeight(nextHeight);
    };

    const handleResizeStart = (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      resizeRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        startHeight: height,
      };
      setResizing(true);
    };

    const handleResizeMove = (event: ReactPointerEvent<HTMLDivElement>) => {
      const resize = resizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) return;
      const viewportMax = Math.max(MIN_HEIGHT, window.innerHeight - 140);
      pendingHeightRef.current = Math.min(
        Math.min(MAX_HEIGHT, viewportMax),
        Math.max(MIN_HEIGHT, resize.startHeight + resize.startY - event.clientY),
      );
      if (resizeFrameRef.current === null) {
        resizeFrameRef.current = requestAnimationFrame(flushResize);
      }
    };

    const handleResizeEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
      if (resizeRef.current?.pointerId !== event.pointerId) return;
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        flushResize();
      }
      resizeRef.current = null;
      setResizing(false);
      requestAnimationFrame(() => fitRef.current?.());
    };

    const changeDirectory = (path: string) => {
      void sessionRef.current?.write(`cd ${shellQuote(path)}\r`);
    };

    return (
      <section
        data-bottom-terminal-drawer
        className={cn(
          "relative flex flex-col overflow-hidden border border-border/70 bg-[var(--terminal-background)] shadow-[0_-16px_36px_-18px_rgba(0,0,0,0.45)] dark:border-zinc-800/80",
          resizing && "select-none",
        )}
        style={{ height }}
        onPointerDown={(event) => {
          event.stopPropagation();
          terminalRef.current?.focus();
        }}
      >
        <div
          role="separator"
          aria-label="Resize bottom terminal"
          aria-orientation="horizontal"
          aria-valuemin={MIN_HEIGHT}
          aria-valuemax={MAX_HEIGHT}
          aria-valuenow={height}
          tabIndex={0}
          onPointerDown={handleResizeStart}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          className="absolute inset-x-0 -top-1 z-20 h-2 cursor-row-resize touch-none before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-border/70 hover:before:bg-primary"
        />
        <div className="relative flex h-9 shrink-0 items-center border-b border-border/60 bg-card/95 px-3 text-sm shadow-sm backdrop-blur dark:border-zinc-800/80 dark:bg-zinc-950/95">
          <TerminalNavigationControls
            cwd={cwd}
            onChangeDirectory={changeDirectory}
          />
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
            className="ml-auto rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Close bottom terminal"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.8} />
          </button>
        </div>
        <div ref={viewportRef} className="min-h-0 flex-1 overflow-hidden" />
      </section>
    );
  },
);

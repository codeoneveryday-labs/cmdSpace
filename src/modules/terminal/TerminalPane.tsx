import { cn } from "@/lib/utils";
import { useTheme } from "@/modules/theme";
import type { SearchAddon } from "@xterm/addon-search";
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { useTerminalSession } from "./lib/useTerminalSession";

export type TerminalPaneHandle = {
  write: (data: string) => void;
  replaceInput: (expected: string, next: string) => boolean;
  replaceCurrentInput: (next: string) => boolean;
  focus: () => void;
  getBuffer: (maxLines?: number) => string | null;
  getSelection: () => string | null;
};

type Props = {
  /** Stable identifier for this leaf (passed back through callbacks). */
  leafId: number;
  /** Tab containing this pane is on screen. */
  visible: boolean;
  /** This leaf is the active pane within its tab — receives auto-focus. */
  focused?: boolean;
  initialCwd?: string;
  initialCommand?: string;
  /** The Cmd+I drawer owns its own tab chrome, so it does not need this inset. */
  contentTopPadding?: boolean;
  onSearchReady?: (leafId: number, addon: SearchAddon) => void;
  onExit?: (leafId: number, code: number) => void;
  onCwd?: (leafId: number, cwd: string) => void;
  onCommand?: (leafId: number, cmd: string) => void;
  onAgentActivity?: (leafId: number, responding: boolean) => void;
  onOutputActivity?: (leafId: number, active: boolean) => void;
};

export const TerminalPane = forwardRef<TerminalPaneHandle, Props>(
  function TerminalPane(
    {
      leafId,
      visible,
      focused = true,
      initialCwd,
      initialCommand,
      contentTopPadding = true,
      onSearchReady,
      onExit,
      onCwd,
      onCommand,
      onAgentActivity,
      onOutputActivity,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedMode, themeId, customThemes } = useTheme();

    const session = useTerminalSession({
      leafId,
      container: containerRef,
      visible,
      focused,
      initialCwd,
      initialCommand,
      onSearchReady: (a) => onSearchReady?.(leafId, a),
      onExit: (c) => onExit?.(leafId, c),
      onCwd: (c) => onCwd?.(leafId, c),
      onCommand: (c) => onCommand?.(leafId, c),
      onAgentActivity: (responding) => onAgentActivity?.(leafId, responding),
      onOutputActivity: (active) => {
        onOutputActivity?.(leafId, active);
      },
    });

    useEffect(() => {
      // Defer one frame so CSS-variable token resolution sees the new class.
      const id = requestAnimationFrame(() => session.applyTheme());
      return () => cancelAnimationFrame(id);
    }, [resolvedMode, themeId, customThemes, session]);

    useImperativeHandle(
      ref,
      () => ({
        write: (data: string) => session.write(data),
        replaceInput: (expected: string, next: string) =>
          session.replaceInput(expected, next),
        replaceCurrentInput: (next: string) => session.replaceCurrentInput(next),
        focus: () => session.focus(),
        getBuffer: (max?: number) => session.getBuffer(max),
        getSelection: () => session.getSelection(),
      }),
      [session],
    );

    return (
      <div
        ref={containerRef}
        className={cn(
          "cmdspace-terminal-viewport h-full w-full overflow-hidden",
          contentTopPadding && "pt-12",
        )}
        style={{
          visibility: visible ? "visible" : "hidden",
          pointerEvents: visible ? "auto" : "none",
        }}
      />
    );
  },
);

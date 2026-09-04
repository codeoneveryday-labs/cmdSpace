import type { SearchAddon } from "@xterm/addon-search";
import { useCallback, useEffect, useMemo } from "react";
import { ensureAgentActivityListener } from "./agentActivity";
import { applyTheme as applyPoolTheme, focusSlot, getSlotForLeaf } from "./rendererPool";
import { useTerminalRendererPreferences } from "./useTerminalRendererPreferences";
import { readTerminalBuffer, readTerminalSelection } from "./terminalSessionReadback";
import { replaceCurrentTerminalInput, replaceUntouchedTerminalInput } from "./terminalInputModel";
import { writeToSessionPty, sessions } from "./terminalSessionRuntime";
import { useTerminalSessionLifecycle } from "./useTerminalSessionLifecycle";
export { disposeSession, replaceSessionCommand, respawnSession } from "./terminalSessionRuntime";

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
  useEffect(() => {
    ensureAgentActivityListener();
  }, []);

  useTerminalSessionLifecycle({
    leafId,
    container,
    visible,
    focused,
    initialCwd,
    initialCommand,
    onSearchReady,
    onExit,
    onCwd,
    onCommand,
    onAgentActivity,
    onOutputActivity,
  });

  useTerminalRendererPreferences();

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
      if (!s) return false;
      return replaceUntouchedTerminalInput(
        {
          hasPty: Boolean(s.pty),
          inputBuffer: s.inputBuffer,
          inCommand: Boolean(s.shellState?.inCommand),
          interactiveCodingAgent: s.interactiveCodingAgent,
        },
        expected,
        next,
        (data) => writeToSessionPty(leafId, s, data),
      );
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
      if (!s) return false;
      return replaceCurrentTerminalInput(
        {
          hasPty: Boolean(s.pty),
          inputBuffer: s.inputBuffer,
          inCommand: Boolean(s.shellState?.inCommand),
          interactiveCodingAgent: s.interactiveCodingAgent,
        },
        next,
        (data) => writeToSessionPty(leafId, s, data),
      );
    },
    [leafId],
  );

  const focus = useCallback(() => focusSlot(leafId), [leafId]);

  const getSessionStartedAt = useCallback(
    () => sessions.get(leafId)?.startedAtMs,
    [leafId],
  );

  const getBuffer = useCallback(
    (maxLines = 200): string | null => {
      const s = sessions.get(leafId);
      if (!s) return null;
      const slot = getSlotForLeaf(leafId);
      return readTerminalBuffer({
        buffer: slot?.term.buffer.active,
        snapshot: s.snapshot,
        maxLines,
      });
    },
    [leafId],
  );

  const getSelection = useCallback((): string | null => {
    const slot = getSlotForLeaf(leafId);
    return readTerminalSelection(slot?.term.getSelection());
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
      getSessionStartedAt,
      getBuffer,
      getSelection,
      applyTheme,
    }),
    [
      write,
      replaceInput,
      replaceCurrentInput,
      focus,
      getSessionStartedAt,
      getBuffer,
      getSelection,
      applyTheme,
    ],
  );
}

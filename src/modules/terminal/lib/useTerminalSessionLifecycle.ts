import type { SearchAddon } from "@xterm/addon-search";
import { useEffect, useRef } from "react";
import { focusSlot, setSlotFocused } from "./rendererPool";
import {
  attachSession,
  bindLeafToSlot,
  detachSession,
  ensureSession,
  sessions,
} from "./terminalSessionRuntime";
import { syncTerminalSessionVisibility } from "./terminalSessionVisibilityModel";

type Options = {
  leafId: number;
  container: React.RefObject<HTMLDivElement | null>;
  visible: boolean;
  focused: boolean;
  initialCwd?: string;
  initialCommand?: string;
  onSearchReady?: (addon: SearchAddon) => void;
  onExit?: (code: number) => void;
  onCwd?: (cwd: string) => void;
  onCommand?: (cmd: string) => void;
  onAgentActivity?: (responding: boolean) => void;
  onOutputActivity?: (active: boolean) => void;
};

export function useTerminalSessionLifecycle({
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
}: Options) {
  const callbackRef = useRef({
    onSearchReady,
    onExit,
    onCwd,
    onCommand,
    onAgentActivity,
    onOutputActivity,
  });
  callbackRef.current = {
    onSearchReady,
    onExit,
    onCwd,
    onCommand,
    onAgentActivity,
    onOutputActivity,
  };

  useEffect(() => {
    let cancelled = false;
    const session = ensureSession(leafId, initialCwd, initialCommand);
    session.ready.then(() => {
      if (cancelled || session.disposed) return;
      const node = container.current;
      if (!node) return;
      attachSession(leafId, node, {
        onSearchReady: (addon) => callbackRef.current.onSearchReady?.(addon),
        onExit: (code) => callbackRef.current.onExit?.(code),
        onCwd: (cwd) => callbackRef.current.onCwd?.(cwd),
        onCommand: (command) => callbackRef.current.onCommand?.(command),
        onAgentActivity: (responding) =>
          callbackRef.current.onAgentActivity?.(responding),
        onOutputActivity: (active) =>
          callbackRef.current.onOutputActivity?.(active),
      });
      if (session.visibleNow && session.focusedNow) focusSlot(leafId);
    });
    return () => {
      cancelled = true;
      detachSession(leafId);
    };
  }, [leafId, container]);

  useEffect(() => {
    const session = sessions.get(leafId);
    if (!session) return;
    syncTerminalSessionVisibility({
      leafId,
      session,
      visible,
      focused,
      bindLeafToSlot,
      setSlotFocused,
      focusSlot,
    });
  }, [leafId, visible, focused]);
}

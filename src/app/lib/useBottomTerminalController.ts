import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { BottomTerminalDrawerHandle } from "@/modules/terminal";
import { findLeafCwd } from "@/modules/terminal/lib/panes";
import type { Tab } from "@/modules/tabs";

export function useBottomTerminalController({
  activeId,
  activeWorkspaceFolder,
  tabs,
  explorerRoot,
  launchCwd,
  home,
  bottomTerminalOpen,
  bottomTerminalRef,
  setBottomTerminalOpen,
  setBottomTerminalCwd,
}: {
  activeId: number;
  activeWorkspaceFolder: string | null;
  tabs: readonly Tab[];
  explorerRoot: string | null;
  launchCwd: string | null;
  home: string | null;
  bottomTerminalOpen: boolean;
  bottomTerminalRef: MutableRefObject<BottomTerminalDrawerHandle | null>;
  setBottomTerminalOpen: Dispatch<SetStateAction<boolean>>;
  setBottomTerminalCwd: Dispatch<SetStateAction<string | null>>;
}) {
  const openBottomTerminal = useCallback(() => {
    const activeTerminal = tabs.find((tab) => tab.id === activeId);
    const cwd =
      activeWorkspaceFolder ??
      (activeTerminal?.kind === "terminal"
        ? findLeafCwd(activeTerminal.paneTree, activeTerminal.activeLeafId) ??
          activeTerminal.cwd
        : null) ??
      explorerRoot ??
      launchCwd ??
      home ??
      null;
    setBottomTerminalCwd(cwd);
    setBottomTerminalOpen(true);
  }, [
    activeId,
    activeWorkspaceFolder,
    explorerRoot,
    home,
    launchCwd,
    setBottomTerminalCwd,
    setBottomTerminalOpen,
    tabs,
  ]);

  const toggleBottomTerminal = useCallback(() => {
    if (bottomTerminalOpen) {
      setBottomTerminalOpen(false);
      return;
    }
    openBottomTerminal();
  }, [bottomTerminalOpen, openBottomTerminal, setBottomTerminalOpen]);

  useEffect(() => {
    if (!bottomTerminalOpen) return;
    const frame = requestAnimationFrame(() => bottomTerminalRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [bottomTerminalOpen, bottomTerminalRef]);

  return { openBottomTerminal, toggleBottomTerminal };
}

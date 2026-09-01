import { useCallback, type MutableRefObject } from "react";
import type { TerminalPaneHandle } from "@/modules/terminal";
import type { Tab } from "@/modules/tabs";

export function useAppTabNavigation({
  tabs,
  tabsRef,
  activeId,
  setActiveId,
  newTab,
  newPrivateTab,
  inheritedCwdForNewTab,
  terminalRefs,
}: {
  tabs: readonly Tab[];
  tabsRef: MutableRefObject<readonly Tab[]>;
  activeId: number;
  setActiveId: (id: number) => void;
  newTab: (cwd?: string) => number;
  newPrivateTab: (cwd?: string) => number;
  inheritedCwdForNewTab: () => string | undefined;
  terminalRefs: MutableRefObject<Map<number, TerminalPaneHandle>>;
}) {
  const cycleTab = useCallback(
    (delta: 1 | -1) => {
      if (tabs.length < 2) return;
      const index = tabs.findIndex((tab) => tab.id === activeId);
      const nextIndex = (index + delta + tabs.length) % tabs.length;
      setActiveId(tabs[nextIndex].id);
    },
    [activeId, setActiveId, tabs],
  );

  const openNewTab = useCallback(() => {
    newTab(inheritedCwdForNewTab());
  }, [inheritedCwdForNewTab, newTab]);

  const openNewPrivateTab = useCallback(() => {
    newPrivateTab(inheritedCwdForNewTab());
  }, [inheritedCwdForNewTab, newPrivateTab]);

  const cdInNewTab = useCallback(
    (path: string) => {
      const tabId = newTab(path);
      setTimeout(() => {
        const tab = tabsRef.current.find((item) => item.id === tabId);
        if (!tab || tab.kind !== "terminal") return;
        const terminal = terminalRefs.current.get(tab.activeLeafId);
        if (!terminal) return;
        const quoted = path.includes(" ")
          ? `'${path.replace(/'/g, `'\\''`)}'`
          : path;
        terminal.write(`cd ${quoted}\r`);
        terminal.focus();
      }, 80);
    },
    [newTab, tabsRef, terminalRefs],
  );

  return { cycleTab, openNewTab, openNewPrivateTab, cdInNewTab };
}

import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { PaneNode, SplitDir } from "@/modules/terminal/lib/panes";
import type { Tab } from "./tabTypes";
import {
  focusNextTerminalPane,
  focusTerminalPane,
  replaceTerminalPaneTree,
  toggleTerminalPaneMaximize,
  updateLeafCwd,
  updateLeafLastCommand,
  updateLeafLaunchCommand,
} from "./tabPaneUpdates";
import {
  appendTerminalPane as appendTerminalPaneModel,
  splitTerminalPane,
} from "./tabPaneLifecycle";

export function useTabPaneActions({
  tabsRef,
  nextIdRef,
  setTabs,
  setActiveId,
}: {
  tabsRef: MutableRefObject<Tab[]>;
  nextIdRef: MutableRefObject<number>;
  setTabs: Dispatch<SetStateAction<Tab[]>>;
  setActiveId: Dispatch<SetStateAction<number>>;
}) {
  const setLeafCwd = useCallback(
    (leafId: number, cwd: string) => {
      setTabs((tabs) => updateLeafCwd(tabs, leafId, cwd));
    },
    [setTabs],
  );

  const setLeafLastCommand = useCallback(
    (leafId: number, lastCommand: string) => {
      setTabs((tabs) => updateLeafLastCommand(tabs, leafId, lastCommand));
    },
    [setTabs],
  );

  const setLeafLaunchCommand = useCallback(
    (leafId: number, command: string | null) => {
      setTabs((tabs) => updateLeafLaunchCommand(tabs, leafId, command));
    },
    [setTabs],
  );

  const setTerminalPaneTree = useCallback(
    (tabId: number, paneTree: PaneNode) => {
      setTabs((tabs) => replaceTerminalPaneTree(tabs, tabId, paneTree));
    },
    [setTabs],
  );

  const focusPane = useCallback(
    (tabId: number, leafId: number) => {
      setTabs((tabs) => focusTerminalPane(tabs, tabId, leafId));
    },
    [setTabs],
  );

  const focusNextPaneInTab = useCallback(
    (tabId: number, delta: 1 | -1) => {
      setTabs((tabs) => focusNextTerminalPane(tabs, tabId, delta));
    },
    [setTabs],
  );

  const splitActivePane = useCallback(
    (
      tabId: number,
      dir: SplitDir,
    ): { leafId: number; paneTree: PaneNode } | null => {
      let result: { leafId: number; paneTree: PaneNode } | null = null;
      setTabs((tabs) =>
        tabs.map((tab) => {
          if (tab.id !== tabId || tab.kind !== "terminal") return tab;
          const next = splitTerminalPane(tab, () => nextIdRef.current++, dir);
          if (!next) return tab;
          result = { leafId: next.leafId, paneTree: next.paneTree };
          return next.tab;
        }),
      );
      return result;
    },
    [nextIdRef, setTabs],
  );

  const appendTerminalPane = useCallback(
    (
      tabId: number,
      cwd: string | undefined,
      initialCommand: string,
    ): { leafId: number; paneTree: PaneNode } | null => {
      const current = tabsRef.current;
      const tab = current.find((item) => item.id === tabId);
      if (!tab || tab.kind !== "terminal") return null;
      const mutation = appendTerminalPaneModel(
        tab,
        () => nextIdRef.current++,
        cwd,
        initialCommand,
      );
      if (!mutation) return null;
      const nextTabs = current.map((item) =>
        item.id === tabId ? mutation.tab : item,
      );
      tabsRef.current = nextTabs;
      setTabs(nextTabs);
      setActiveId(tabId);
      return { leafId: mutation.leafId, paneTree: mutation.paneTree };
    },
    [nextIdRef, setActiveId, setTabs, tabsRef],
  );

  const toggleMaximizePane = useCallback(
    (leafId: number): void => {
      setTabs((tabs) => toggleTerminalPaneMaximize(tabs, leafId));
    },
    [setTabs],
  );

  return {
    setLeafCwd,
    setLeafLastCommand,
    setLeafLaunchCommand,
    setTerminalPaneTree,
    focusPane,
    focusNextPaneInTab,
    splitActivePane,
    appendTerminalPane,
    toggleMaximizePane,
  };
}

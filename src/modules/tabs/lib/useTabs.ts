import { useCallback, useEffect, useRef, useState } from "react";
import { createInitialTerminalTab } from "./tabFactories";
import { reorderTabs, tabAtIndex, type TabPlacement } from "./tabTransitions";
import { useTabCreationActions } from "./useTabCreationActions";
import { useTabOpenActions } from "./useTabOpenActions";
import { useTabCloseActions } from "./useTabCloseActions";
import { useTabPaneActions } from "./useTabPaneActions";
import type {
  Tab,
  TerminalTab,
} from "./tabTypes";

export * from "./tabTypes";

// Matches the renderer slot pool size — over this we'd evict an active leaf.
export { MAX_PANES_PER_TAB } from "./tabPaneModel";



export function useTabs(initial?: Partial<TerminalTab>) {
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const tabId = 1;
    const leafId = 2;
    return [createInitialTerminalTab({ id: tabId, leafId, title: initial?.title, cwd: initial?.cwd })];
  });
  const [activeId, setActiveId] = useState(1);
  const nextIdRef = useRef(3);
  const tabsRef = useRef(tabs);

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  const {
    newTab,
    newPrivateTab,
    newWorkspaceTab,
    newAgentChatTab,
    newMarkdownTab,
    newArchitectureTab,
  } = useTabCreationActions({
    nextIdRef,
    setTabs,
    setActiveId,
  });

  const {
    openFileTab,
    pinTab,
    openAiDiffTab,
    setAiDiffStatus,
    closeAiDiffTab,
    openGitDiffTab,
    openCommitHistoryTab,
    openCommitFileDiffTab,
    updateTab,
  } = useTabOpenActions({
    tabsRef,
    nextIdRef,
    setTabs,
    setActiveId,
  });

  const { closeTab, closePaneByLeaf, closeActivePane, resetWorkspace } =
    useTabCloseActions({
      nextIdRef,
      setTabs,
      setActiveId,
    });

  const {
    setLeafCwd,
    setLeafLastCommand,
    setLeafLaunchCommand,
    setTerminalPaneTree,
    focusPane,
    focusNextPaneInTab,
    splitActivePane,
    appendTerminalPane,
    toggleMaximizePane,
  } = useTabPaneActions({
    tabsRef,
    nextIdRef,
    setTabs,
    setActiveId,
  });

  const selectByIndex = useCallback(
    (idx: number) => {
      const t = tabAtIndex(tabs, idx);
      if (t) setActiveId(t.id);
    },
    [tabs],
  );

  const reorderTab = useCallback(
    (
      draggedId: number,
      targetId: number,
      placement: TabPlacement = "before",
    ) => {
      if (draggedId === targetId) return;
      setTabs((curr) => reorderTabs(curr, draggedId, targetId, placement));
    },
    [],
  );

  return {
    tabs,
    activeId,
    setActiveId,
    newTab,
    newPrivateTab,
    newWorkspaceTab,
    newAgentChatTab,
    openFileTab,
    pinTab,
    newMarkdownTab,
    newArchitectureTab,
    openAiDiffTab,
    openGitDiffTab,
    openCommitHistoryTab,
    openCommitFileDiffTab,
    setAiDiffStatus,
    closeAiDiffTab,
    closeTab,
    updateTab,
    selectByIndex,
    reorderTab,
    setLeafCwd,
    setLeafLaunchCommand,
    setLeafLastCommand,
    setTerminalPaneTree,
    focusPane,
    focusNextPaneInTab,
    splitActivePane,
    appendTerminalPane,
    closeActivePane,
    closePaneByLeaf,
    toggleMaximizePane,
    resetWorkspace,
  };
}

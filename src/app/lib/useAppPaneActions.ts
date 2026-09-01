import { useCallback, type MutableRefObject } from "react";
import { leafIds, type PaneNode } from "@/modules/terminal/lib/panes";
import type { Tab, TerminalTab } from "@/modules/tabs";

export function useAppPaneActions({
  activeId,
  activeTerminalTab,
  tabsRef,
  splitActivePane,
  persistSplitPaneTree,
  closeActivePane,
  handleClose,
  toggleMaximizePane,
}: {
  activeId: number;
  activeTerminalTab: TerminalTab | null;
  tabsRef: MutableRefObject<readonly Tab[]>;
  splitActivePane: (
    tabId: number,
    direction: "row" | "col",
  ) => { paneTree: PaneNode } | null;
  persistSplitPaneTree: (tabId: number, paneTree: PaneNode) => void;
  closeActivePane: (tabId: number) => void;
  handleClose: (tabId: number) => void;
  toggleMaximizePane: (leafId: number) => void;
}) {
  const splitActivePaneInActiveTab = useCallback(
    (direction: "row" | "col") => {
      const tab = tabsRef.current.find((item) => item.id === activeId);
      if (!tab || tab.kind !== "terminal") return;
      const appended = splitActivePane(activeId, direction);
      if (appended) persistSplitPaneTree(activeId, appended.paneTree);
    },
    [activeId, persistSplitPaneTree, splitActivePane, tabsRef],
  );

  const handleCloseTabOrPane = useCallback(() => {
    const tab = tabsRef.current.find((item) => item.id === activeId);
    if (tab?.kind === "terminal" && leafIds(tab.paneTree).length > 1) {
      closeActivePane(activeId);
      return;
    }
    handleClose(activeId);
  }, [activeId, closeActivePane, handleClose, tabsRef]);

  const maximizeActivePane = useCallback(() => {
    if (activeTerminalTab) {
      toggleMaximizePane(activeTerminalTab.activeLeafId);
    }
  }, [activeTerminalTab, toggleMaximizePane]);

  return {
    splitActivePaneInActiveTab,
    handleCloseTabOrPane,
    maximizeActivePane,
  };
}

import {
  hasLeaf,
  leafIds,
  removeLeaf,
  siblingLeafOf,
} from "@/modules/terminal/lib/panes";
import type { Tab, TerminalTab } from "./tabTypes";

export function closePaneFromTerminalTab(
  tab: TerminalTab,
  leafId: number,
): { tab: TerminalTab | null; removed: boolean } {
  const nextTree = removeLeaf(tab.paneTree, leafId);
  if (nextTree === null) return { tab: null, removed: true };
  const remaining = leafIds(nextTree);
  let activeLeafId = tab.activeLeafId;
  if (tab.activeLeafId === leafId) {
    const sibling = siblingLeafOf(tab.paneTree, leafId);
    activeLeafId = sibling && remaining.includes(sibling) ? sibling : remaining[0];
  }
  return {
    tab: {
      ...tab,
      paneTree: nextTree,
      activeLeafId,
      maximizedLeafId: tab.maximizedLeafId === leafId ? undefined : tab.maximizedLeafId,
    },
    removed: true,
  };
}

export function closeTerminalPaneState(
  tabs: Tab[],
  tabId: number,
  leafId: number,
): {
  tabs: Tab[];
  removed: boolean;
  closedTab: boolean;
  disposedLeafId: number | null;
  replacementActiveId: number | null;
} {
  const tabIndex = tabs.findIndex((tab) => tab.id === tabId);
  const tab = tabs[tabIndex];
  if (!tab || tab.kind !== "terminal" || !hasLeaf(tab.paneTree, leafId)) {
    return {
      tabs,
      removed: false,
      closedTab: false,
      disposedLeafId: null,
      replacementActiveId: null,
    };
  }

  const result = closePaneFromTerminalTab(tab, leafId);
  if (!result.tab) {
    if (tabs.length <= 1) {
      return {
        tabs,
        removed: true,
        closedTab: false,
        disposedLeafId: leafId,
        replacementActiveId: null,
      };
    }
    const nextTabs = tabs.filter((item) => item.id !== tabId);
    return {
      tabs: nextTabs,
      removed: true,
      closedTab: true,
      disposedLeafId: leafId,
      replacementActiveId: nextTabs[Math.max(0, tabIndex - 1)].id,
    };
  }

  return {
    tabs: tabs.map((item) => (item.id === tabId ? result.tab! : item)),
    removed: true,
    closedTab: false,
    disposedLeafId: leafId,
    replacementActiveId: null,
  };
}

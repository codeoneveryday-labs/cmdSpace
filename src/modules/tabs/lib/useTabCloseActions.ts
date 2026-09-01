import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { hasLeaf } from "@/modules/terminal/lib/panes";
import { disposeSession } from "@/modules/terminal/lib/useTerminalSession";
import { closeTabState, resetWorkspaceState } from "./tabCloseModel";
import { closeTerminalPaneState } from "./tabPaneClose";
import type { Tab } from "./tabTypes";

export function useTabCloseActions({
  nextIdRef,
  setTabs,
  setActiveId,
}: {
  nextIdRef: MutableRefObject<number>;
  setTabs: Dispatch<SetStateAction<Tab[]>>;
  setActiveId: Dispatch<SetStateAction<number>>;
}) {
  const closeTab = useCallback((id: number) => {
    let toDispose: number[] = [];
    setTabs((tabs) => {
      const index = tabs.findIndex((tab) => tab.id === id);
      const result = closeTabState(tabs, -1, id);
      if (index < 0 || tabs.length <= 1) return tabs;
      toDispose = result.disposedLeafIds;
      setActiveId((active) => (id === active ? result.activeId : active));
      return result.tabs;
    });
    for (const leafId of toDispose) disposeSession(leafId);
  }, [setActiveId, setTabs]);

  const closePaneByLeaf = useCallback((leafId: number): void => {
    let disposedLeafId: number | null = null;
    setTabs((tabs) => {
      const tab = tabs.find(
        (item) => item.kind === "terminal" && hasLeaf(item.paneTree, leafId),
      );
      if (!tab || tab.kind !== "terminal") return tabs;
      const result = closeTerminalPaneState(tabs, tab.id, leafId);
      if (!result.removed) return tabs;
      disposedLeafId = result.disposedLeafId;
      if (result.replacementActiveId !== null) {
        setActiveId((active) =>
          active === tab.id ? result.replacementActiveId! : active,
        );
      }
      return result.tabs;
    });
    if (disposedLeafId !== null) disposeSession(disposedLeafId);
  }, [setActiveId, setTabs]);

  const closeActivePane = useCallback((tabId: number): boolean => {
    let closedTab = false;
    let disposedLeafId: number | null = null;
    setTabs((tabs) => {
      const tab = tabs.find((item) => item.id === tabId);
      if (!tab || tab.kind !== "terminal") return tabs;
      const result = closeTerminalPaneState(tabs, tabId, tab.activeLeafId);
      if (!result.removed) return tabs;
      disposedLeafId = result.disposedLeafId;
      closedTab = result.closedTab;
      if (result.replacementActiveId !== null) {
        setActiveId((active) =>
          active === tabId ? result.replacementActiveId! : active,
        );
      }
      return result.tabs;
    });
    if (disposedLeafId !== null) disposeSession(disposedLeafId);
    return closedTab;
  }, [setActiveId, setTabs]);

  const resetWorkspace = useCallback((cwd?: string) => {
    const tabId = nextIdRef.current++;
    const leafId = nextIdRef.current++;
    let toDispose: number[] = [];
    setTabs((tabs) => {
      const result = resetWorkspaceState(tabs, tabId, leafId, cwd);
      toDispose = result.disposedLeafIds;
      return result.tabs;
    });
    setActiveId(tabId);
    for (const oldLeafId of toDispose) disposeSession(oldLeafId);
  }, [nextIdRef, setActiveId, setTabs]);

  return { closeTab, closePaneByLeaf, closeActivePane, resetWorkspace };
}

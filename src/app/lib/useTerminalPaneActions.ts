import { useCallback } from "react";
import {
  hasLeaf,
  leafIds,
  swapLeafNodes,
  type PaneNode,
} from "@/modules/terminal";
import { clearAgentCompleted } from "@/modules/terminal/lib/agentActivity";
import type { Tab } from "@/modules/tabs";

export function useTerminalPaneActions({
  tabsRef,
  focusPane,
  handlePaneTreeChange,
  closePaneByLeaf,
  clearWorkspaceTabOwnership,
  respawnSession,
}: {
  tabsRef: { current: Tab[] };
  focusPane: (tabId: number, leafId: number) => void;
  handlePaneTreeChange: (tabId: number, paneTree: PaneNode) => void;
  closePaneByLeaf: (leafId: number) => void;
  clearWorkspaceTabOwnership: (tabId: number) => void;
  respawnSession: (leafId: number, cwd?: string) => Promise<void>;
}) {
  const swapWorkspaceTerminals = useCallback(
    (sourceId: number, targetId: number) => {
      const tab = tabsRef.current.find(
        (item) =>
          item.kind === "terminal" &&
          hasLeaf(item.paneTree, sourceId) &&
          hasLeaf(item.paneTree, targetId),
      );
      if (!tab || tab.kind !== "terminal") return;
      const paneTree = swapLeafNodes(tab.paneTree, sourceId, targetId);
      if (paneTree === tab.paneTree) return;
      handlePaneTreeChange(tab.id, paneTree);
      focusPane(tab.id, sourceId);
    },
    [focusPane, handlePaneTreeChange, tabsRef],
  );

  const focusLeaf = useCallback(
    (tabId: number, leafId: number) => {
      clearAgentCompleted(leafId);
      focusPane(tabId, leafId);
    },
    [focusPane],
  );

  const handleLeafExit = useCallback(
    (leafId: number, _code: number) => {
      const tabs = tabsRef.current;
      const tab = tabs.find(
        (item) => item.kind === "terminal" && hasLeaf(item.paneTree, leafId),
      );
      if (!tab || tab.kind !== "terminal") return;
      const isLast =
        leafIds(tab.paneTree).length === 1 &&
        tabs.filter((item) => item.kind === "terminal").length === 1;
      if (isLast) {
        void respawnSession(leafId, tab.cwd);
        return;
      }
      if (leafIds(tab.paneTree).length === 1) {
        clearWorkspaceTabOwnership(tab.id);
      }
      closePaneByLeaf(leafId);
    },
    [clearWorkspaceTabOwnership, closePaneByLeaf, respawnSession, tabsRef],
  );

  return { swapWorkspaceTerminals, focusLeaf, handleLeafExit };
}

import { useCallback } from "react";
import { hasLeaf } from "@/modules/terminal/lib/panes";
import type { Tab } from "@/modules/tabs";
import { selectDirectionalPane, type PaneDirection } from "./paneNavigationModel";

export function useDirectionalPaneFocus({
  activeLeafId,
  activeTab,
  focusPane,
}: {
  activeLeafId: number | null;
  activeTab: Tab | undefined;
  focusPane: (tabId: number, leafId: number) => void;
}) {
  return useCallback(
    (direction: PaneDirection) => {
      if (activeLeafId === null || !activeTab) return;
      const activeLeaf = document.querySelector(
        `[data-pane-leaf="${activeLeafId}"]`,
      );
      if (!activeLeaf) return;
      const activeRect = activeLeaf.getBoundingClientRect();
      const activeCenter = {
        x: activeRect.left + activeRect.width / 2,
        y: activeRect.top + activeRect.height / 2,
      };

      const candidates: { id: number; center: { x: number; y: number } }[] = [];
      document.querySelectorAll("[data-pane-leaf]").forEach((element) => {
        const id = Number.parseInt(element.getAttribute("data-pane-leaf") ?? "", 10);
        if (Number.isNaN(id) || id === activeLeafId) return;
        if (activeTab.kind === "terminal" && !hasLeaf(activeTab.paneTree, id)) {
          return;
        }
        const rect = element.getBoundingClientRect();
        candidates.push({
          id,
          center: {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          },
        });
      });

      const targetId = selectDirectionalPane(activeCenter, candidates, direction);
      if (targetId !== null) focusPane(activeTab.id, targetId);
    },
    [activeLeafId, activeTab, focusPane],
  );
}

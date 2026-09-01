import { leafIds } from "@/modules/terminal/lib/panes";
import type { Tab } from "./tabTypes";
import { createInitialTerminalTab } from "./tabFactories";

export function resetWorkspaceState(
  tabs: readonly Tab[],
  id: number,
  leafId: number,
  cwd?: string,
): { tabs: Tab[]; disposedLeafIds: number[] } {
  return {
    tabs: [createInitialTerminalTab({ id, leafId, cwd })],
    disposedLeafIds: tabs.flatMap((tab) => tab.kind === "terminal" ? leafIds(tab.paneTree) : []),
  };
}

export function closeTabState(
  tabs: readonly Tab[],
  activeId: number,
  id: number,
): { tabs: Tab[]; activeId: number; disposedLeafIds: number[] } {
  if (tabs.length <= 1) {
    return { tabs: [...tabs], activeId, disposedLeafIds: [] };
  }
  const index = tabs.findIndex((tab) => tab.id === id);
  if (index < 0) return { tabs: [...tabs], activeId, disposedLeafIds: [] };
  const target = tabs[index];
  const nextTabs = tabs.filter((tab) => tab.id !== id);
  return {
    tabs: nextTabs,
    activeId:
      id === activeId ? nextTabs[Math.max(0, index - 1)].id : activeId,
    disposedLeafIds: target.kind === "terminal" ? leafIds(target.paneTree) : [],
  };
}

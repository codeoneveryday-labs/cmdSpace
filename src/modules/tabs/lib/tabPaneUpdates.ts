import {
  findLeafCwd,
  hasLeaf,
  leafIds,
  nextLeafId,
  setLeafCwd as setLeafCwdInTree,
  setLeafLaunchCommand as setLeafLaunchCommandInTree,
  setLeafLastCommand as setLeafLastCommandInTree,
} from "@/modules/terminal/lib/panes";
import type { Tab } from "./tabTypes";

export function updateLeafCwd(tabs: readonly Tab[], leafId: number, cwd: string): Tab[] {
  let changed = false;
  const next = tabs.map((tab) => {
    if (tab.kind !== "terminal" || !hasLeaf(tab.paneTree, leafId)) return tab;
    const paneTree = setLeafCwdInTree(tab.paneTree, leafId, cwd);
    const cwdChanged = tab.activeLeafId === leafId && tab.cwd !== cwd;
    if (paneTree === tab.paneTree && !cwdChanged) return tab;
    changed = true;
    return { ...tab, paneTree, ...(cwdChanged && { cwd }) };
  });
  return changed ? next : [...tabs];
}

export function updateLeafLastCommand(tabs: readonly Tab[], leafId: number, command: string): Tab[] {
  let changed = false;
  const next = tabs.map((tab) => {
    if (tab.kind !== "terminal" || !hasLeaf(tab.paneTree, leafId)) return tab;
    const paneTree = setLeafLastCommandInTree(tab.paneTree, leafId, command);
    if (paneTree === tab.paneTree) return tab;
    changed = true;
    return { ...tab, paneTree };
  });
  return changed ? next : [...tabs];
}

export function updateLeafLaunchCommand(tabs: readonly Tab[], leafId: number, command: string | null): Tab[] {
  let changed = false;
  const next = tabs.map((tab) => {
    if (tab.kind !== "terminal" || !hasLeaf(tab.paneTree, leafId)) return tab;
    const paneTree = setLeafLaunchCommandInTree(tab.paneTree, leafId, command);
    if (paneTree === tab.paneTree) return tab;
    changed = true;
    return { ...tab, paneTree };
  });
  return changed ? next : [...tabs];
}

export function focusTerminalPane(tabs: readonly Tab[], tabId: number, leafId: number): Tab[] {
  return tabs.map((tab) => {
    if (tab.id !== tabId || tab.kind !== "terminal" || !hasLeaf(tab.paneTree, leafId) || tab.activeLeafId === leafId) return tab;
    const cwd = findLeafCwd(tab.paneTree, leafId);
    return { ...tab, activeLeafId: leafId, ...(cwd !== undefined && { cwd }) };
  });
}

export function focusNextTerminalPane(
  tabs: readonly Tab[],
  tabId: number,
  delta: 1 | -1,
): Tab[] {
  return tabs.map((tab) => {
    if (tab.id !== tabId || tab.kind !== "terminal") return tab;
    const next = nextLeafId(tab.paneTree, tab.activeLeafId, delta);
    if (next === tab.activeLeafId) return tab;
    const cwd = findLeafCwd(tab.paneTree, next);
    return { ...tab, activeLeafId: next, ...(cwd !== undefined && { cwd }) };
  });
}

export function replaceTerminalPaneTree(
  tabs: readonly Tab[],
  tabId: number,
  paneTree: import("@/modules/terminal/lib/panes").PaneNode,
): Tab[] {
  return tabs.map((tab) => {
    if (tab.id !== tabId || tab.kind !== "terminal") return tab;
    const ids = leafIds(paneTree);
    const activeLeafId = ids.includes(tab.activeLeafId) ? tab.activeLeafId : ids[0];
    return {
      ...tab,
      paneTree,
      activeLeafId,
      maximizedLeafId:
        tab.maximizedLeafId !== undefined && ids.includes(tab.maximizedLeafId)
          ? tab.maximizedLeafId
          : undefined,
    };
  });
}

export function toggleTerminalPaneMaximize(tabs: readonly Tab[], leafId: number): Tab[] {
  return tabs.map((tab) => {
    if (tab.kind !== "terminal" || !hasLeaf(tab.paneTree, leafId)) return tab;
    return {
      ...tab,
      maximizedLeafId: tab.maximizedLeafId === leafId ? undefined : leafId,
    };
  });
}

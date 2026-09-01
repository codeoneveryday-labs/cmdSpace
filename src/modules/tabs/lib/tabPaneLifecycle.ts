import {
  leafIds,
  splitLeaf,
  type PaneNode,
  type SplitDir,
} from "@/modules/terminal/lib/panes";
import type { TerminalTab } from "./tabTypes";
import { MAX_PANES_PER_TAB } from "./tabPaneModel";

export type PaneMutationResult = {
  tab: TerminalTab;
  leafId: number;
  paneTree: PaneNode;
};

export function splitTerminalPane(
  tab: TerminalTab,
  nextId: () => number,
  dir: SplitDir,
): PaneMutationResult | null {
  if (leafIds(tab.paneTree).length >= MAX_PANES_PER_TAB) return null;
  const splitId = nextId();
  const leafId = nextId();
  const paneTree = splitLeaf(tab.paneTree, tab.activeLeafId, splitId, leafId, dir, tab.cwd);
  return {
    tab: { ...tab, paneTree, activeLeafId: leafId, maximizedLeafId: undefined },
    leafId,
    paneTree,
  };
}

export function appendTerminalPane(
  tab: TerminalTab,
  nextId: () => number,
  cwd: string | undefined,
  initialCommand: string,
): PaneMutationResult | null {
  if (leafIds(tab.paneTree).length >= MAX_PANES_PER_TAB) return null;
  const splitId = nextId();
  const leafId = nextId();
  const paneTree = splitLeaf(tab.paneTree, tab.activeLeafId, splitId, leafId, "row", cwd, initialCommand);
  return {
    tab: { ...tab, cwd, paneTree, activeLeafId: leafId, maximizedLeafId: undefined },
    leafId,
    paneTree,
  };
}

import type { TerminalTab } from "@/modules/tabs";

import {
  findLeafAutoLaunch,
  findLeafCwd,
  findLeafLastCommand,
  leafIds,
  type PaneNode,
} from "./panes";

export type TerminalPaneRenderState = {
  node: PaneNode | null;
  leafIds: number[];
};

export function getTerminalPaneRenderState(
  tab: TerminalTab | null,
): TerminalPaneRenderState {
  if (!tab) return { node: null, leafIds: [] };
  const maximizedLeafId = tab.maximizedLeafId;
  if (maximizedLeafId === undefined) {
    return { node: tab.paneTree, leafIds: leafIds(tab.paneTree) };
  }

  const node: PaneNode = {
    kind: "leaf",
    id: maximizedLeafId,
    cwd: findLeafCwd(tab.paneTree, maximizedLeafId),
    lastCommand: findLeafLastCommand(tab.paneTree, maximizedLeafId),
    autoLaunch: findLeafAutoLaunch(tab.paneTree, maximizedLeafId),
  };
  return { node, leafIds: [maximizedLeafId] };
}

import { useMemo } from "react";
import type { Tab } from "@/modules/tabs";
import type { WorkspaceTerminalItem } from "@/modules/workspaces";
import { buildActiveTerminalItems } from "./workspaceItemsModel";

export function useAppWorkspaceTerminalView({
  activeTab,
  activeLeafId,
  agentCommands,
  respondingLeaves,
  requestedLeaves,
  blockedLeaves,
  completedLeaves,
  closePaneByLeaf,
}: {
  activeTab: Tab | undefined;
  activeLeafId: number | null;
  agentCommands: ReadonlyMap<number, string>;
  respondingLeaves: ReadonlySet<number>;
  requestedLeaves: ReadonlySet<number>;
  blockedLeaves: ReadonlySet<number>;
  completedLeaves: ReadonlySet<number>;
  closePaneByLeaf: (leafId: number) => void;
}): {
  activeWorkspaceTerminals: WorkspaceTerminalItem[];
} {
  const activeTerminalTab =
    activeTab?.kind === "terminal" ? activeTab : undefined;
  const activeWorkspaceTerminals = useMemo(
    () =>
      buildActiveTerminalItems({
        tab: activeTerminalTab,
        activeLeafId,
        agentCommands,
        respondingLeaves,
        requestedLeaves,
        blockedLeaves,
        completedLeaves,
        closePaneByLeaf,
      }),
    [
      activeLeafId,
      activeTerminalTab,
      agentCommands,
      blockedLeaves,
      closePaneByLeaf,
      completedLeaves,
      requestedLeaves,
      respondingLeaves,
    ],
  );

  return {
    activeWorkspaceTerminals,
  };
}

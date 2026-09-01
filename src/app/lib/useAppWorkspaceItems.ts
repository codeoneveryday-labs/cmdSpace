import { useMemo, type MutableRefObject } from "react";
import type { Tab } from "@/modules/tabs";
import type {
  WorkspaceItem,
  WorkspaceTerminalItem,
} from "@/modules/workspaces";
import type { WorkspaceRecord } from "./useWorkspaceController";
import type { WorkspaceSelectionPane } from "./useWorkspaceSelection";
import { buildWorkspaceItems } from "./workspaceItemsModel";

export function useAppWorkspaceItems({
  workspaces,
  tabs,
  activeId,
  activeWorkspaceId,
  activeWorkspaceTerminals,
  persistedWorkspacePanes,
  agentCommands,
  respondingLeaves,
  requestedLeaves,
  blockedLeaves,
  completedLeaves,
  activeCanvasTerminalIds,
  canvasTerminalSelectionVersion,
  canvasTerminalRefs,
  closeTabActionRef,
  closePaneByLeaf,
  canvasTerminalRefKey,
}: {
  workspaces: WorkspaceRecord[];
  tabs: Tab[];
  activeId: number;
  activeWorkspaceId: string | null;
  activeWorkspaceTerminals: WorkspaceTerminalItem[];
  persistedWorkspacePanes: Record<string, WorkspaceSelectionPane[]>;
  agentCommands: ReadonlyMap<number, string>;
  respondingLeaves: ReadonlySet<number>;
  requestedLeaves: ReadonlySet<number>;
  blockedLeaves: ReadonlySet<number>;
  completedLeaves: ReadonlySet<number>;
  activeCanvasTerminalIds: ReadonlyMap<number, string>;
  canvasTerminalSelectionVersion: number;
  canvasTerminalRefs: MutableRefObject<Map<string, { close: () => void }>>;
  closeTabActionRef: MutableRefObject<(tabId: number) => void>;
  closePaneByLeaf: (leafId: number) => void;
  canvasTerminalRefKey: (tabId: number, nodeId: string) => string;
}): WorkspaceItem[] {
  return useMemo(
    () =>
      buildWorkspaceItems({
        workspaces,
        tabs,
        activeId,
        activeWorkspaceId,
        activeWorkspaceTerminals,
        persistedWorkspacePanes,
        agentCommands,
        respondingLeaves,
        requestedLeaves,
        blockedLeaves,
        completedLeaves,
        activeCanvasTerminalIds,
        closePaneByLeaf,
        closeCanvasTerminal: (tabId, nodeId) =>
          canvasTerminalRefs.current
            .get(canvasTerminalRefKey(tabId, nodeId))
            ?.close(),
        closeAgentTab: (tabId) => closeTabActionRef.current(tabId),
      }),
    [
      activeCanvasTerminalIds,
      activeId,
      activeWorkspaceId,
      activeWorkspaceTerminals,
      agentCommands,
      blockedLeaves,
      canvasTerminalRefKey,
      closePaneByLeaf,
      completedLeaves,
      persistedWorkspacePanes,
      respondingLeaves,
      requestedLeaves,
      tabs,
      workspaces,
      canvasTerminalSelectionVersion,
    ],
  );
}

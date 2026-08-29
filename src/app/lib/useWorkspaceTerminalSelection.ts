import {
  useCallback,
  useEffect,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { clearAgentCompleted } from "@/modules/terminal/lib/agentActivity";
import { hasLeaf } from "@/modules/terminal/lib/panes";
import type { Tab } from "@/modules/tabs";
import type { WorkspaceRecord } from "./useWorkspaceController";

type PendingWorkspaceTerminal = { workspaceId: string; leafId: number };

type WorkspaceTerminalSelectionPorts = {
  activeCanvasTerminalIds: MutableRefObject<Map<number, string>>;
  pendingWorkspaceTerminalRef: MutableRefObject<PendingWorkspaceTerminal | null>;
  tabsRef: MutableRefObject<Tab[]>;
  workspacesRef: MutableRefObject<WorkspaceRecord[]>;
  tabs: Tab[];
  workspaces: WorkspaceRecord[];
  setActiveId: (id: number) => void;
  setCanvasTerminalSelectionVersion: Dispatch<SetStateAction<number>>;
  focusPane: (tabId: number, leafId: number) => void;
  handleSelectWorkspace: (workspaceId: string) => void;
};

export function useWorkspaceTerminalSelection({
  activeCanvasTerminalIds,
  pendingWorkspaceTerminalRef,
  tabsRef,
  workspacesRef,
  tabs,
  workspaces,
  setActiveId,
  setCanvasTerminalSelectionVersion,
  focusPane,
  handleSelectWorkspace,
}: WorkspaceTerminalSelectionPorts) {
  const handleSelectWorkspaceTerminal = useCallback(
    (workspaceId: string, leafId: number) => {
      const workspace = workspacesRef.current.find(
        (item) => item.id === workspaceId,
      );
      if (workspace?.tabId === null || workspace?.tabId === undefined) {
        if (workspace?.canvasTabId !== null && workspace?.canvasTabId !== undefined) {
          const canvasTab = tabsRef.current.find(
            (item) => item.id === workspace.canvasTabId,
          );
          if (canvasTab?.kind === "architecture") {
            const terminalNodes =
              canvasTab.diagram?.nodes.filter((node) => node.kind === "terminal") ?? [];
            const node = terminalNodes[-leafId - 1];
            if (node) {
              activeCanvasTerminalIds.current.set(canvasTab.id, node.id);
              setCanvasTerminalSelectionVersion((version) => version + 1);
            }
          }
          setActiveId(workspace.canvasTabId);
          return;
        }
        pendingWorkspaceTerminalRef.current = { workspaceId, leafId };
        handleSelectWorkspace(workspaceId);
        return;
      }
      const tab = tabsRef.current.find((item) => item.id === workspace.tabId);
      if (tab?.kind !== "terminal" || !hasLeaf(tab.paneTree, leafId)) return;
      clearAgentCompleted(leafId);
      setActiveId(tab.id);
      focusPane(tab.id, leafId);
    },
    [activeCanvasTerminalIds, focusPane, handleSelectWorkspace, pendingWorkspaceTerminalRef, setActiveId, setCanvasTerminalSelectionVersion, tabsRef, workspacesRef],
  );

  useEffect(() => {
    const pending = pendingWorkspaceTerminalRef.current;
    if (!pending) return;
    const workspace = workspacesRef.current.find(
      (item) => item.id === pending.workspaceId,
    );
    if (!workspace?.tabId) return;
    const tab = tabsRef.current.find((item) => item.id === workspace.tabId);
    if (tab?.kind !== "terminal" || !hasLeaf(tab.paneTree, pending.leafId)) return;
    pendingWorkspaceTerminalRef.current = null;
    clearAgentCompleted(pending.leafId);
    setActiveId(tab.id);
    focusPane(tab.id, pending.leafId);
  }, [focusPane, pendingWorkspaceTerminalRef, setActiveId, tabs, tabsRef, workspaces, workspacesRef]);

  return { handleSelectWorkspaceTerminal };
}

export type { PendingWorkspaceTerminal };

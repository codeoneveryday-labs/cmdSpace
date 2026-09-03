import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { clearAgentCompleted } from "@/modules/terminal/lib/agentActivity";
import { hasLeaf, leafIds } from "@/modules/terminal/lib/panes";
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
  const pendingTrayPaneFocusRef = useRef<{ workspaceId?: string; paneIndex: number } | null>(null);

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

  const tryFocusPendingTrayPane = useCallback(() => {
    const pending = pendingTrayPaneFocusRef.current;
    if (!pending) return;
    const { workspaceId, paneIndex } = pending;

    const targetWorkspace = workspaceId
      ? workspacesRef.current.find((item) => item.id === workspaceId)
      : workspacesRef.current.find((item) => item.tabId !== null && item.tabId !== undefined) ??
        workspacesRef.current[0];
    if (!targetWorkspace) return;

    if (targetWorkspace.canvasTabId !== null && targetWorkspace.canvasTabId !== undefined) {
      const canvasTab = tabsRef.current.find(
        (item) => item.id === targetWorkspace.canvasTabId,
      );
      if (canvasTab?.kind === "architecture") {
        const terminalNodes =
          canvasTab.diagram?.nodes.filter((node) => node.kind === "terminal") ?? [];
        const node = terminalNodes[paneIndex];
        if (node) {
          pendingTrayPaneFocusRef.current = null;
          activeCanvasTerminalIds.current.set(canvasTab.id, node.id);
          setCanvasTerminalSelectionVersion((version) => version + 1);
          setActiveId(canvasTab.id);
          return;
        }
      }
    }

    if (targetWorkspace.tabId !== null && targetWorkspace.tabId !== undefined) {
      const tab = tabsRef.current.find((item) => item.id === targetWorkspace.tabId);
      if (tab?.kind === "terminal") {
        const leaves = leafIds(tab.paneTree);
        const targetLeafId = leaves[paneIndex] ?? leaves[0];
        if (targetLeafId !== undefined) {
          pendingTrayPaneFocusRef.current = null;
          clearAgentCompleted(targetLeafId);
          setActiveId(tab.id);
          focusPane(tab.id, targetLeafId);
        }
      }
    }
  }, [
    activeCanvasTerminalIds,
    focusPane,
    setActiveId,
    setCanvasTerminalSelectionVersion,
    tabsRef,
    workspacesRef,
  ]);

  useEffect(() => {
    const unlisten = listen<{ workspaceId?: string; paneIndex: number } | number>(
      "cmdspace:focus-workspace-pane",
      (event) => {
        const payload = event.payload;
        const paneIndex = typeof payload === "number" ? payload : payload.paneIndex;
        const workspaceId = typeof payload === "object" ? payload.workspaceId : undefined;
        pendingTrayPaneFocusRef.current = { workspaceId, paneIndex };
        tryFocusPendingTrayPane();
      },
    );
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, [tryFocusPendingTrayPane]);

  useEffect(() => {
    tryFocusPendingTrayPane();
  }, [tabs, workspaces, tryFocusPendingTrayPane]);

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

import { useCallback, type MutableRefObject } from "react";
import type { Tab } from "@/modules/tabs";
import type { WorkspaceRecord, DeleteWorkspaceInput } from "./useWorkspaceController";

export function selectWorkspaceDeletionFallback(
  remainingWorkspaces: readonly WorkspaceRecord[],
  recentWorkspaces: readonly Pick<WorkspaceRecord, "id">[],
  deletedWorkspaceId: string,
) {
  return (
    recentWorkspaces.find(
      (item) =>
        item.id !== deletedWorkspaceId &&
        remainingWorkspaces.some((candidate) => candidate.id === item.id),
    ) ?? remainingWorkspaces[0]
  );
}

export function useWorkspaceDeletion({
  workspacesRef,
  tabsRef,
  recentWorkspaces,
  activeWorkspaceId,
  selectWorkspace,
  removeWorkspace,
  disposeTab,
  resetWorkspace,
  fallbackCwd,
}: {
  workspacesRef: MutableRefObject<readonly WorkspaceRecord[]>;
  tabsRef: MutableRefObject<readonly Tab[]>;
  recentWorkspaces: readonly Pick<WorkspaceRecord, "id">[];
  activeWorkspaceId: string | null;
  selectWorkspace: (workspaceId: string) => void | Promise<void>;
  removeWorkspace: (input: DeleteWorkspaceInput) => void;
  disposeTab: (tabId: number) => void;
  resetWorkspace: (cwd?: string) => void;
  fallbackCwd: string | undefined;
}) {
  return useCallback(
    async (workspaceId: string) => {
      if (workspacesRef.current.length <= 1) return;
      const workspace = workspacesRef.current.find((item) => item.id === workspaceId);
      if (!workspace) return;
      const remainingWorkspaces = workspacesRef.current.filter(
        (item) => item.id !== workspaceId,
      );
      if (activeWorkspaceId === workspaceId && remainingWorkspaces.length > 0) {
        const fallback = selectWorkspaceDeletionFallback(
          remainingWorkspaces,
          recentWorkspaces,
          workspaceId,
        );
        if (fallback) void selectWorkspace(fallback.id);
      }
      const tabIds = new Set(
        [workspace.tabId, workspace.canvasTabId, ...(workspace.agentTabIds ?? [])].filter(
          (tabId): tabId is number => tabId !== null,
        ),
      );
      removeWorkspace({
        workspaceId,
        tabIds,
        wouldLeaveNoTabs:
          tabIds.size > 0 && tabsRef.current.every((tab) => tabIds.has(tab.id)),
        disposeTab,
        resetWorkspace,
        fallbackCwd,
      });
    },
    [
      activeWorkspaceId,
      disposeTab,
      fallbackCwd,
      recentWorkspaces,
      removeWorkspace,
      resetWorkspace,
      selectWorkspace,
      tabsRef,
      workspacesRef,
    ],
  );
}

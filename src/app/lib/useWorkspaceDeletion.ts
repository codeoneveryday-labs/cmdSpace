import { useCallback, type MutableRefObject } from "react";
import type { Tab } from "@/modules/tabs";
import type { WorkspaceRecord, DeleteWorkspaceInput } from "./useWorkspaceController";

export function useWorkspaceDeletion({
  workspacesRef,
  tabsRef,
  removeWorkspace,
  disposeTab,
  resetWorkspace,
  fallbackCwd,
}: {
  workspacesRef: MutableRefObject<readonly WorkspaceRecord[]>;
  tabsRef: MutableRefObject<readonly Tab[]>;
  removeWorkspace: (input: DeleteWorkspaceInput) => void;
  disposeTab: (tabId: number) => void;
  resetWorkspace: (cwd?: string) => void;
  fallbackCwd: string | undefined;
}) {
  return useCallback(
    (workspaceId: string) => {
      if (workspacesRef.current.length <= 1) return;
      const workspace = workspacesRef.current.find((item) => item.id === workspaceId);
      if (!workspace) return;
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
    [disposeTab, fallbackCwd, removeWorkspace, resetWorkspace, tabsRef, workspacesRef],
  );
}

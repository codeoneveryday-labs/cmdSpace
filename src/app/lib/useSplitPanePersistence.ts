import { useCallback, type MutableRefObject } from "react";
import type { PaneNode } from "@/modules/terminal/lib/panes";
import {
  findLeafAutoLaunch,
  findLeafCwd,
  findLeafLastCommand,
  leafIds,
} from "@/modules/terminal/lib/panes";
import type {
  WorkspaceRecord,
} from "./useWorkspaceController";
import type { PersistedPaneRecord } from "./useWorkspaceController";
import type { WorkspaceSelectionPane } from "./useWorkspaceSelection";

export function useSplitPanePersistence({
  workspacesRef,
  setWorkspaces,
  persistWorkspace,
  persistPaneRecord,
  persistedPaneFor,
  buildPaneRecord,
}: {
  workspacesRef: MutableRefObject<readonly WorkspaceRecord[]>;
  setWorkspaces: (
    update: (current: WorkspaceRecord[]) => WorkspaceRecord[],
  ) => void;
  persistWorkspace: (workspace: WorkspaceRecord) => void;
  persistPaneRecord: (pane: PersistedPaneRecord) => Promise<unknown>;
  persistedPaneFor: (workspaceId: string, paneIndex: number) =>
    | WorkspaceSelectionPane
    | undefined;
  buildPaneRecord: typeof import("./workspacePaneRecordModel").buildWorkspacePaneRecord;
}) {
  return useCallback(
    (tabId: number, paneTree: PaneNode) => {
      const workspace = workspacesRef.current.find(
        (item) => item.tabId === tabId,
      );
      if (!workspace) return;
      const updated = {
        ...workspace,
        count: leafIds(paneTree).length,
        paneLayout: JSON.stringify(paneTree),
        updatedAt: Date.now(),
      };
      setWorkspaces((current) =>
        current.map((item) => (item.id === workspace.id ? updated : item)),
      );
      persistWorkspace(updated);
      void Promise.all(
        leafIds(paneTree).map((leafId, paneIndex) =>
          persistPaneRecord(
            buildPaneRecord(
              workspace.id,
              paneIndex,
              findLeafCwd(paneTree, leafId) ?? workspace.workingFolder,
              findLeafLastCommand(paneTree, leafId) ?? null,
              findLeafAutoLaunch(paneTree, leafId),
              persistedPaneFor(workspace.id, paneIndex),
            ),
          ),
        ),
      ).catch((error) => {
        console.error("Failed to persist split terminal panes:", error);
      });
    },
    [
      buildPaneRecord,
      persistPaneRecord,
      persistWorkspace,
      persistedPaneFor,
      setWorkspaces,
      workspacesRef,
    ],
  );
}

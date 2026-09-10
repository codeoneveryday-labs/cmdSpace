import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  listWorkspaces,
  normalizeWorkspaceAccentColor,
  parseIpcError,
  type WorkspaceItem,
  type WorkspaceMode,
  type WorkspaceDto,
  type WorkspaceInvoke,
} from "@/modules/workspaces";
import type { WorkspaceSelectionPane } from "./useWorkspaceSelection";
import type { WorkspaceRecord } from "./useWorkspaceController";
import { workspaceAccentForIndex } from "./workspaceCreationModel";
import { buildRecentWorkspaceItem } from "./workspaceRecordModel";

export type PersistedWorkspaceRecord = WorkspaceDto;

type PersistedRecentWorkspaceRecord = WorkspaceItem & {
  workingFolder: string;
  updatedAt: number;
};

type Invoke = WorkspaceInvoke;

export function normalizeHydratedWorkspace(
  workspace: PersistedWorkspaceRecord,
  index: number,
): WorkspaceRecord {
  return {
    ...workspace,
    accentColor: normalizeWorkspaceAccentColor(
      workspace.accentColor,
      workspaceAccentForIndex(index),
    ),
    paneLayout: workspace.paneLayout ?? null,
    pinned: workspace.pinned ?? false,
    tabId: null,
    canvasTabId: null,
    workspaceMode:
      workspace.workspaceMode === "canvas"
        ? "canvas"
        : ("standard" as WorkspaceMode),
  };
}

export function useWorkspaceHydration({
  invoke,
  setWorkspaces,
  setRecentWorkspaces,
  setPersistedWorkspacePanes,
  setWorkspacesHydrated,
}: {
  invoke: Invoke;
  setWorkspaces: Dispatch<SetStateAction<WorkspaceRecord[]>>;
  setRecentWorkspaces: Dispatch<SetStateAction<WorkspaceItem[]>>;
  setPersistedWorkspacePanes: Dispatch<
    SetStateAction<Record<string, WorkspaceSelectionPane[]>>
  >;
  setWorkspacesHydrated: Dispatch<SetStateAction<boolean>>;
}): void {
  useEffect(() => {
    void listWorkspaces(invoke)
      .then((list) => {
        const hydrated = list.map(normalizeHydratedWorkspace);
        setWorkspaces(hydrated);
        setWorkspacesHydrated(true);
        void Promise.all(
          hydrated.map(async (workspace) => {
            try {
              const panes = await invoke<WorkspaceSelectionPane[]>(
                "db_list_panes",
                { workspaceId: workspace.id },
              );
              return [workspace.id, panes] as const;
            } catch {
              return [workspace.id, []] as const;
            }
          }),
        ).then((entries) => setPersistedWorkspacePanes(Object.fromEntries(entries)));
      })
      .catch((error) => {
        const ipcError = parseIpcError(error);
        console.error(
          `Failed to load workspaces from SQLite [${ipcError.code}]:`,
          ipcError.message,
        );
        setWorkspacesHydrated(true);
      });

    void invoke<PersistedRecentWorkspaceRecord[]>("db_list_recent_workspaces")
      .then((list) => {
        setRecentWorkspaces(
          list.flatMap((workspace, index) => {
            const normalized = {
              ...workspace,
              accentColor: normalizeWorkspaceAccentColor(
                workspace.accentColor,
                workspaceAccentForIndex(index),
              ),
            };
            const recent = buildRecentWorkspaceItem(normalized);
            return recent ? [recent] : [];
          }),
        );
      })
      .catch((error) => {
        const ipcError = parseIpcError(error);
        console.error(
          `Failed to load recent workspaces from SQLite [${ipcError.code}]:`,
          ipcError.message,
        );
      });
  }, [invoke, setPersistedWorkspacePanes, setRecentWorkspaces, setWorkspaces, setWorkspacesHydrated]);
}

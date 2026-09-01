import { invoke } from "@tauri-apps/api/core";
import { useCallback } from "react";
import { normalizeWorkspaceAccentColor } from "@/modules/workspaces";
import type { WorkspaceRecord } from "./workspaceControllerTypes";
import {
  reorderWorkspaceRecords,
  uniqueWorkspaceName,
} from "./workspaceRecordModel";

export function useWorkspaceRecordActions({
  workspaces,
  setWorkspaces,
  updateTab,
}: {
  workspaces: WorkspaceRecord[];
  setWorkspaces: React.Dispatch<React.SetStateAction<WorkspaceRecord[]>>;
  updateTab: (tabId: number, patch: { title: string }) => void;
}) {
  const renameWorkspace = useCallback(
    (workspaceId: string, name: string) => {
      const nextName = uniqueWorkspaceName(workspaces, workspaceId, name);
      if (!nextName) return;
      setWorkspaces((current) =>
        current.map((workspace) => {
          if (workspace.id !== workspaceId) return workspace;
          if (workspace.tabId !== null) {
            updateTab(workspace.tabId, { title: nextName });
          }
          if (workspace.canvasTabId !== null) {
            updateTab(workspace.canvasTabId, { title: nextName });
          }
          const updated = { ...workspace, name: nextName, updatedAt: Date.now() };
          void invoke("db_save_workspace", { workspace: updated }).catch((error) =>
            console.error("Failed to save renamed workspace to SQLite:", error),
          );
          return updated;
        }),
      );
    },
    [setWorkspaces, updateTab, workspaces],
  );

  const changeWorkspaceColor = useCallback(
    (workspaceId: string, accentColor: string) => {
      const nextAccentColor = normalizeWorkspaceAccentColor(accentColor);
      setWorkspaces((current) =>
        current.map((workspace) => {
          if (
            workspace.id !== workspaceId ||
            workspace.accentColor === nextAccentColor
          ) {
            return workspace;
          }
          const updated = {
            ...workspace,
            accentColor: nextAccentColor,
            updatedAt: Date.now(),
          };
          void invoke("db_save_workspace", { workspace: updated }).catch((error) =>
            console.error("Failed to save workspace color to SQLite:", error),
          );
          return updated;
        }),
      );
    },
    [setWorkspaces],
  );

  const reorderWorkspaces = useCallback(
    (draggedId: string, targetId: string, position: "before" | "after") => {
      setWorkspaces((current) => {
        const reordered = reorderWorkspaceRecords(
          current,
          draggedId,
          targetId,
          position,
        );
        if (!reordered) return current;
        void invoke("db_reorder_workspaces", {
          orders: reordered.map((item) => [item.id, item.displayOrder]),
        }).catch((error) =>
          console.error("Failed to save reordered workspaces to SQLite:", error),
        );
        return reordered;
      });
    },
    [setWorkspaces],
  );

  return {
    renameWorkspace,
    changeWorkspaceColor,
    reorderWorkspaces,
  };
}

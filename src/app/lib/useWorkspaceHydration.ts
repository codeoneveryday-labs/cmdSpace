import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import {
  normalizeWorkspaceAccentColor,
  type WorkspaceItem,
  type WorkspaceMode,
} from "@/modules/workspaces";
import type { WorkspaceSelectionPane } from "./useWorkspaceSelection";
import type { WorkspaceRecord } from "./useWorkspaceController";
import { workspaceAccentForIndex } from "./workspaceCreationModel";
import { buildRecentWorkspaceItem } from "./workspaceRecordModel";

export type PersistedWorkspaceRecord = Omit<
  WorkspaceRecord,
  "accentColor" | "tabId" | "canvasTabId" | "agentProvider" | "agentSessionId" | "agentTabIds"
> & {
  accentColor?: string | null;
  agentProvider?: CliAgent | null;
  agentSessionId?: string | null;
  agentProviders?: CliAgent[] | null;
  agentSessionIds?: Array<string | null> | null;
  agentChatIds?: string[] | null;
};

type PersistedRecentWorkspaceRecord = WorkspaceItem & {
  workingFolder: string;
  updatedAt: number;
};

type Invoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

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
    tabId: null,
    canvasTabId: null,
    workspaceMode:
      workspace.workspaceMode === "canvas"
        ? "canvas"
        : workspace.workspaceMode === "agent"
          ? "agent"
          : ("standard" as WorkspaceMode),
    agentProvider: workspace.agentProvider ?? null,
    agentSessionId: workspace.agentSessionId ?? null,
    agentTabIds: [],
    agentProviders: workspace.agentProviders ?? [],
    agentSessionIds: workspace.agentSessionIds ?? [],
    agentChatIds: workspace.agentChatIds ?? [],
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
    void invoke<PersistedWorkspaceRecord[]>("db_list_workspaces")
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
        console.error("Failed to load workspaces from SQLite:", error);
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
        console.error("Failed to load recent workspaces from SQLite:", error);
      });
  }, [invoke, setPersistedWorkspacePanes, setRecentWorkspaces, setWorkspaces, setWorkspacesHydrated]);
}

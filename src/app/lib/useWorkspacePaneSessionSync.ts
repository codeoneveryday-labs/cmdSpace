import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { ImportableAgentSession } from "@/modules/workspaces";
import { assignSessionsToPanes } from "@/modules/workspaces/lib/importSessions";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { WorkspaceSelectionPane } from "./useWorkspaceSelection";

type PersistedPaneRecord = {
  workspaceId: string;
  paneIndex: number;
  workingFolder: string;
  lastCommand: string | null;
  autoLaunch: boolean;
  agentProvider: CliAgent | null;
  nativeSessionId: string | null;
};

type WorkspacePaneSessionSyncProps = {
  persistedWorkspacePanesRef: MutableRefObject<
    Record<string, WorkspaceSelectionPane[]>
  >;
  reservedNativeSessionIdsRef: MutableRefObject<Map<string, string>>;
  workspacePaneLaunchAtRef: MutableRefObject<Map<string, number>>;
  workspacePaneSyncTimersRef: MutableRefObject<Map<string, number[]>>;
  setPersistedWorkspacePanes: Dispatch<
    SetStateAction<Record<string, WorkspaceSelectionPane[]>>
  >;
  persistPaneRecord: (pane: PersistedPaneRecord) => Promise<unknown>;
};

export function useWorkspacePaneSessionSync({
  persistedWorkspacePanesRef,
  reservedNativeSessionIdsRef,
  workspacePaneLaunchAtRef,
  workspacePaneSyncTimersRef,
  setPersistedWorkspacePanes,
  persistPaneRecord,
}: WorkspacePaneSessionSyncProps) {
  const syncWorkspacePaneNativeSessions = useCallback(
    async (workspaceId: string, workspaceCwd: string | null) => {
      if (!workspaceCwd) return [] as WorkspaceSelectionPane[];
      const [panes, sessions] = await Promise.all([
        invoke<WorkspaceSelectionPane[]>("db_list_panes", { workspaceId }),
        invoke<ImportableAgentSession[]>("list_agent_sessions", {
          limit: 500,
          workspaceCwd,
        }),
      ]);
      const claimedSessionIds = Object.entries(
        persistedWorkspacePanesRef.current,
      )
        .filter(([id]) => id !== workspaceId)
        .flatMap(([, workspacePanes]) =>
          workspacePanes
            .map((pane) => pane.nativeSessionId)
            .filter((value): value is string => Boolean(value)),
        );
      for (const [sessionId, ownerWorkspaceId] of reservedNativeSessionIdsRef.current) {
        if (ownerWorkspaceId !== workspaceId && !claimedSessionIds.includes(sessionId)) {
          claimedSessionIds.push(sessionId);
        }
      }
      const resolvedPanes = assignSessionsToPanes(
        panes,
        sessions,
        workspaceCwd,
        claimedSessionIds,
        new Map(
          panes
            .map((pane) => [
              pane.paneIndex,
              workspacePaneLaunchAtRef.current.get(`${workspaceId}:${pane.paneIndex}`),
            ] as const)
            .filter((entry): entry is readonly [number, number] => entry[1] !== undefined),
        ),
      );
      for (const pane of resolvedPanes) {
        if (pane.nativeSessionId) {
          reservedNativeSessionIdsRef.current.set(pane.nativeSessionId, workspaceId);
        }
      }
      const changedPanes = resolvedPanes.filter((pane, index) => {
        const previous = panes[index];
        return (
          pane.lastCommand !== previous?.lastCommand ||
          pane.agentProvider !== previous?.agentProvider ||
          pane.nativeSessionId !== previous?.nativeSessionId
        );
      });
      if (changedPanes.length === 0) {
        setPersistedWorkspacePanes((current) => ({
          ...current,
          [workspaceId]: resolvedPanes,
        }));
        return resolvedPanes;
      }
      await Promise.all(
        changedPanes.map((pane) =>
          persistPaneRecord({
            workspaceId,
            paneIndex: pane.paneIndex,
            workingFolder: pane.workingFolder ?? workspaceCwd,
            lastCommand: pane.lastCommand,
            autoLaunch: pane.autoLaunch,
            agentProvider: pane.agentProvider ?? null,
            nativeSessionId: pane.nativeSessionId ?? null,
          }),
        ),
      );
      return resolvedPanes;
    },
    [persistPaneRecord, persistedWorkspacePanesRef, reservedNativeSessionIdsRef, setPersistedWorkspacePanes, workspacePaneLaunchAtRef],
  );

  const scheduleWorkspacePaneSessionSync = useCallback(
    (workspaceId: string, workspaceCwd: string | null) => {
      if (!workspaceCwd) return;
      const current = workspacePaneSyncTimersRef.current.get(workspaceId) ?? [];
      for (const timer of current) window.clearTimeout(timer);
      const timers = [1_200, 4_000].map((delay) =>
        window.setTimeout(() => {
          void syncWorkspacePaneNativeSessions(workspaceId, workspaceCwd).catch(
            (error) => {
              console.error("Failed to sync workspace pane native sessions:", error);
            },
          );
        }, delay),
      );
      workspacePaneSyncTimersRef.current.set(workspaceId, timers);
    },
    [syncWorkspacePaneNativeSessions, workspacePaneSyncTimersRef],
  );

  useEffect(() => {
    return () => {
      for (const timers of workspacePaneSyncTimersRef.current.values()) {
        for (const timer of timers) window.clearTimeout(timer);
      }
      workspacePaneSyncTimersRef.current.clear();
    };
  }, [workspacePaneSyncTimersRef]);

  return { syncWorkspacePaneNativeSessions, scheduleWorkspacePaneSessionSync };
}

import { invoke } from "@tauri-apps/api/core";
import { useCallback, useRef, useState } from "react";
import type { WorkspaceItem } from "@/modules/workspaces";
import { detectCliAgent } from "@/modules/terminal/lib/cliAgents";
import type { WorkspaceSelectionPane } from "./useWorkspaceSelection";
import type { ArchitectureDiagram } from "@/modules/tabs";
import {
  findLeafAutoLaunch,
  findLeafCwd,
  findLeafLastCommand,
  leafIds,
  type PaneNode,
} from "@/modules/terminal/lib/panes";
import { buildSessionResumeCommand } from "@/modules/workspaces/lib/importSessions";
import {
  buildRecentWorkspaceItem,
  updateWorkspaceFromPaneTree,
} from "./workspaceRecordModel";
import { useWorkspaceRecordActions } from "./useWorkspaceRecordActions";
import { createWorkspaceAction } from "./workspaceCreationAction";
import {
  appendAgentWorkspaceTerminal,
  prepareAgentWorkspaceTerminal,
} from "./workspaceAgentSessionModel";
import { useWorkspaceHydration } from "./useWorkspaceHydration";
import type {
  CreateWorkspaceInput,
  CreateWorkspaceTerminalInput,
  DeleteWorkspaceInput,
  ImportAgentSessionInput,
  PersistedPaneRecord,
  WorkspaceRecord,
} from "./workspaceControllerTypes";
export type {
  CreateWorkspaceInput,
  CreateWorkspaceTerminalInput,
  DeleteWorkspaceInput,
  ImportAgentSessionInput,
  PersistedPaneRecord,
  WorkspaceRecord,
} from "./workspaceControllerTypes";

export function useWorkspaceController({
  updateTab,
}: {
  updateTab: (tabId: number, patch: { title: string }) => void;
}) {
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([]);
  const [recentWorkspaces, setRecentWorkspaces] = useState<WorkspaceItem[]>([]);
  const [persistedWorkspacePanes, setPersistedWorkspacePanes] = useState<
    Record<string, WorkspaceSelectionPane[]>
  >({});
  const [workspacesHydrated, setWorkspacesHydrated] = useState(false);
  const persistedWorkspacePanesRef = useRef(persistedWorkspacePanes);
  persistedWorkspacePanesRef.current = persistedWorkspacePanes;
  const pendingPaneWritesRef = useRef(new Set<Promise<unknown>>());

  const setPersistedPaneRecord = useCallback((pane: PersistedPaneRecord) => {
    const { workspaceId, ...persistedPane } = pane;
    setPersistedWorkspacePanes((current) => ({
      ...current,
      [workspaceId]: [
        ...(current[workspaceId] ?? []).filter(
          (item) => item.paneIndex !== persistedPane.paneIndex,
        ),
        persistedPane,
      ].sort((left, right) => left.paneIndex - right.paneIndex),
    }));
  }, []);

  const persistedPaneFor = useCallback(
    (workspaceId: string, paneIndex: number) =>
      persistedWorkspacePanesRef.current[workspaceId]?.find(
        (pane) => pane.paneIndex === paneIndex,
      ),
    [],
  );

  const persistPaneRecord = useCallback(
    async (pane: PersistedPaneRecord) => {
      setPersistedPaneRecord(pane);
      const write = invoke("db_save_pane", { pane });
      pendingPaneWritesRef.current.add(write);
      try {
        await write;
      } finally {
        pendingPaneWritesRef.current.delete(write);
      }
    },
    [setPersistedPaneRecord],
  );

  const flushPendingPaneWrites = useCallback(async () => {
    while (pendingPaneWritesRef.current.size > 0) {
      await Promise.all([...pendingPaneWritesRef.current]);
    }
  }, []);

  const saveRecentWorkspace = useCallback((workspace: WorkspaceItem) => {
    const recent = buildRecentWorkspaceItem(workspace as WorkspaceRecord);
    if (!recent) return;
    setRecentWorkspaces((current) =>
      [recent, ...current.filter((item) => item.id !== recent.id)].slice(0, 6),
    );
    void invoke("db_save_recent_workspace", { workspace: recent }).catch((error) => {
      console.error("Failed to save recent workspace to SQLite:", error);
    });
  }, []);

  const {
    renameWorkspace,
    changeWorkspaceColor,
    reorderWorkspaces,
  } = useWorkspaceRecordActions({
    workspaces,
    setWorkspaces,
    updateTab,
  });

  const deleteWorkspace = useCallback(
    ({
      workspaceId,
      tabIds,
      wouldLeaveNoTabs,
      disposeTab,
      resetWorkspace,
      fallbackCwd,
    }: DeleteWorkspaceInput) => {
      if (workspaces.length <= 1) return;
      if (!workspaces.some((workspace) => workspace.id === workspaceId)) return;
      if (wouldLeaveNoTabs) resetWorkspace(fallbackCwd);
      else for (const tabId of tabIds) disposeTab(tabId);
      setWorkspaces((current) =>
        current.filter((workspace) => workspace.id !== workspaceId),
      );
      void invoke("db_delete_workspace", { id: workspaceId }).catch((error) =>
        console.error("Failed to delete workspace from SQLite:", error),
      );
    },
    [workspaces],
  );

  const createWorkspaceTerminal = useCallback(
    (input: CreateWorkspaceTerminalInput): boolean => {
      const workspace = workspaces.find((item) => item.id === input.workspaceId);
      if (!workspace) return false;
      const command = input.initialCommand;
      if (workspace.workspaceMode === "agent") {
        const tabs = input.tabsRef.current.filter(
          (tab) =>
            tab.kind === "agent-chat" &&
            (tab.id === workspace.tabId || workspace.agentTabIds?.includes(tab.id)),
        );
        const plan = prepareAgentWorkspaceTerminal(workspace, command, tabs.length);
        if (!plan) return false;
        const tabId = input.newAgentChatTab({
          title: plan.title,
          provider: plan.provider,
          cwd: plan.cwd,
          nativeSessionId: null,
          chatId: plan.chatId,
        });
        const updated = appendAgentWorkspaceTerminal(
          workspace,
          tabId,
          plan.provider,
          plan.chatId,
          tabs.length + 1,
        );
        setWorkspaces((current) =>
          current.map((item) => (item.id === workspace.id ? updated : item)),
        );
        input.saveRecentWorkspace(updated);
        void invoke("db_save_workspace", { workspace: updated });
        input.setActiveId(tabId);
        return true;
      }
      if (workspace.workspaceMode === "canvas") {
        const tabId = workspace.canvasTabId;
        if (tabId === null || tabId === undefined) return false;
        return input.canvasTerminalCreators.current.get(tabId)?.(command || undefined) ?? false;
      }
      if (workspace.tabId === null) return false;
      const tab = input.tabsRef.current.find((item) => item.id === workspace.tabId);
      if (!tab || tab.kind !== "terminal") return false;
      const appended = input.appendTerminalPane(workspace.tabId, workspace.workingFolder ?? tab.cwd, command);
      if (!appended) return false;
      const paneTree = appended.paneTree as PaneNode;
      const updated = updateWorkspaceFromPaneTree(workspace, paneTree);
      setWorkspaces((current) =>
        current.map((item) => (item.id === workspace.id ? updated : item)),
      );
      input.saveRecentWorkspace(updated);
      void Promise.all([
        invoke("db_save_workspace", { workspace: updated }),
        ...leafIds(paneTree).map((leafId, paneIndex) =>
          input.persistPaneRecord(
            input.buildPaneRecord(
              workspace.id,
              paneIndex,
              findLeafCwd(paneTree, leafId) ?? workspace.workingFolder,
              findLeafLastCommand(paneTree, leafId) ?? null,
              findLeafAutoLaunch(paneTree, leafId),
              input.persistedPaneFor(workspace.id, paneIndex),
            ),
          ),
        ),
      ]).catch((error) => console.error("Failed to persist created workspace terminal:", error));
      if (command && detectCliAgent(command)) {
        const paneIndex = Math.max(0, leafIds(paneTree).length - 1);
        input.markWorkspacePaneLaunch(workspace.id, paneIndex);
        input.scheduleWorkspacePaneSessionSync(workspace.id, workspace.workingFolder ?? tab.cwd ?? null);
      }
      return true;
    },
    [workspaces],
  );

  const importAgentSession = useCallback(
    async (input: ImportAgentSessionInput): Promise<boolean> => {
      if (input.session.active) return false;
      const workspace = workspaces.find((item) => item.id === input.workspaceId);
      if (!workspace) return false;
      const initialCommand = buildSessionResumeCommand(
        input.session.provider,
        input.session.sessionId,
      );

      if (workspace.workspaceMode === "canvas") {
        const tab = input.tabsRef.current.find(
          (item) => item.id === workspace.canvasTabId,
        );
        if (!tab || tab.kind !== "architecture") return false;
        const diagram = tab.diagram ?? { nodes: [], edges: [] };
        if (
          diagram.nodes.some(
            (node) => node.kind === "terminal" && node.initialCommand === initialCommand,
          )
        ) {
          input.alert("This agent session is already open in the workspace.");
          return false;
        }
        const terminalIndex = diagram.nodes.filter((node) => node.kind === "terminal").length;
        if (terminalIndex >= 12) {
          input.alert("Workspace terminal limit reached (12).");
          return false;
        }
        const nextDiagram: ArchitectureDiagram = {
          ...diagram,
          nodes: [
            ...diagram.nodes,
            {
              id: `imported-session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              kind: "terminal",
              label: `${input.session.provider} session`,
              technology: "",
              x: 96 + (terminalIndex % 2) * 668,
              y: 96 + Math.floor(terminalIndex / 2) * 448,
              width: 620,
              height: 400,
              cwd: input.session.cwd,
              initialCommand,
              terminalChromeVersion: 2,
            },
          ],
        };
        input.updateCanvasDiagram(tab.id, nextDiagram);
        input.setActiveId(tab.id);
        return true;
      }

      if (workspace.tabId === null) return false;
      const tab = input.tabsRef.current.find((item) => item.id === workspace.tabId);
      if (
        !tab ||
        tab.kind !== "terminal" ||
        leafIds(tab.paneTree).some(
          (leafId) => findLeafLastCommand(tab.paneTree, leafId) === initialCommand,
        )
      ) {
        if (tab?.kind === "terminal") {
          input.alert("This agent session is already open in the workspace.");
        }
        return false;
      }
      const appended = input.appendTerminalPane(workspace.tabId, input.session.cwd, initialCommand);
      if (!appended) {
        input.alert("Workspace terminal limit reached (12).");
        return false;
      }
      const paneTree = appended.paneTree as PaneNode;
      const updated = updateWorkspaceFromPaneTree(workspace, paneTree);
      setWorkspaces((current) =>
        current.map((item) => (item.id === workspace.id ? updated : item)),
      );
      input.saveRecentWorkspace(updated);
      const paneIds = leafIds(paneTree);
      void Promise.all([
        invoke("db_save_workspace", { workspace: updated }),
        ...paneIds.map((leafId, paneIndex) =>
          input.persistPaneRecord(
            input.buildPaneRecord(
              workspace.id,
              paneIndex,
              findLeafCwd(paneTree, leafId) ?? workspace.workingFolder,
              findLeafLastCommand(paneTree, leafId) ?? null,
              findLeafAutoLaunch(paneTree, leafId),
              input.persistedPaneFor(workspace.id, paneIndex),
              paneIndex === paneIds.length - 1 ? input.session.sessionId : null,
            ),
          ),
        ),
      ]).catch((error) => console.error("Failed to persist imported agent session pane:", error));
      input.scheduleWorkspacePaneSessionSync(workspace.id, workspace.workingFolder ?? input.session.cwd);
      return true;
    },
    [workspaces],
  );

  const createWorkspace = useCallback(
    (input: CreateWorkspaceInput) =>
      createWorkspaceAction(input, {
        workspaces,
        setWorkspaces,
        persistPaneRecord,
        saveRecentWorkspace,
      }),
    [persistPaneRecord, saveRecentWorkspace, workspaces],
  );

  useWorkspaceHydration({
    invoke,
    setWorkspaces,
    setRecentWorkspaces,
    setPersistedWorkspacePanes,
    setWorkspacesHydrated,
  });

  return {
    workspaces,
    setWorkspaces,
    recentWorkspaces,
    setRecentWorkspaces,
    persistedWorkspacePanes,
    setPersistedWorkspacePanes,
    persistedWorkspacePanesRef,
    workspacesHydrated,
    setWorkspacesHydrated,
    persistedPaneFor,
    persistPaneRecord,
    flushPendingPaneWrites,
    saveRecentWorkspace,
    renameWorkspace,
    changeWorkspaceColor,
    reorderWorkspaces,
    createWorkspace,
    deleteWorkspace,
    createWorkspaceTerminal,
    importAgentSession,
  };
}

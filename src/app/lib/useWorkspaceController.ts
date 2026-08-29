import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_WORKSPACE_ACCENT_COLOR,
  normalizeWorkspaceAccentColor,
  WORKSPACE_ACCENT_COLORS,
} from "@/modules/workspaces";
import type { WorkspaceItem } from "@/modules/workspaces";
import { detectCliAgent, type CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { WorkspaceSelectionPane } from "./useWorkspaceSelection";
import type { ArchitectureDiagram, Tab } from "@/modules/tabs";
import { serializeCanvasWorkspaceDiagram } from "@/modules/architecture";
import {
  findLeafAutoLaunch,
  findLeafCwd,
  findLeafLastCommand,
  leafIds,
  type PaneNode,
} from "@/modules/terminal/lib/panes";
import type { WorkspaceMode } from "@/modules/workspaces";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";
import type { ImportableAgentSession } from "@/modules/workspaces";
import { buildSessionResumeCommand } from "@/modules/workspaces/lib/importSessions";

export type WorkspaceRecord = WorkspaceItem & {
  workingFolder: string | null;
  createdAt: number;
  updatedAt: number;
  displayOrder: number;
  paneLayout: string | null;
  tabId: number | null;
  canvasTabId: number | null;
  agentProvider: CliAgent | null;
  agentSessionId: string | null;
  agentTabIds?: number[];
  agentProviders?: CliAgent[];
  agentSessionIds?: Array<string | null>;
  agentChatIds?: string[];
};

type PersistedWorkspaceRecord = Omit<
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

export type PersistedPaneRecord = WorkspaceSelectionPane & { workspaceId: string };

export type CreateWorkspaceInput = {
  terminalCount: number;
  workingFolder: string | null;
  initialCommands?: string[];
  requestedName?: string;
  requestedColor?: string;
  workspaceMode?: WorkspaceMode;
  workspaceAgent?: CliAgent | null;
  workspaceAgents?: CliAgent[];
  initialAgentDraft?: string;
  initialHistoryAttachments?: AgentChatHistoryAttachment[];
  inheritedCwd: string | undefined;
  nextWorkspaceName: (workspaces: WorkspaceRecord[]) => string | null;
  tabs: Tab[];
  newAgentChatTab: (input: {
    title: string;
    provider: CliAgent;
    cwd: string;
    nativeSessionId: null;
    chatId: string;
    initialDraft?: string;
    initialHistoryAttachments?: AgentChatHistoryAttachment[];
  }) => number;
  newWorkspaceTab: (
    cwd: string | undefined,
    paneCount: number,
    panes?: Array<{
      paneIndex: number;
      workingFolder: string | null;
      lastCommand: string | null;
      autoLaunch: boolean;
    }>,
    paneLayout?: string | null,
    title?: string,
  ) => number;
  newArchitectureTab: (diagram?: ArchitectureDiagram, title?: string) => number;
  closeTab: (tabId: number) => void;
  setActiveId: (tabId: number) => void;
  closeSetup: () => void;
  alert: (message: string) => void;
};

export type DeleteWorkspaceInput = {
  workspaceId: string;
  tabIds: ReadonlySet<number>;
  wouldLeaveNoTabs: boolean;
  disposeTab: (tabId: number) => void;
  resetWorkspace: (cwd?: string) => void;
  fallbackCwd?: string;
};

export type CreateWorkspaceTerminalInput = {
  workspaceId: string | null;
  initialCommand: string;
  tabsRef: { current: Tab[] };
  canvasTerminalCreators: { current: Map<number, (command?: string) => boolean> };
  appendTerminalPane: (
    tabId: number,
    cwd: string | undefined,
    initialCommand: string,
  ) => { paneTree: unknown } | null;
  newAgentChatTab: (input: {
    title: string;
    provider: CliAgent;
    cwd: string;
    nativeSessionId: null;
    chatId: string;
  }) => number;
  setActiveId: (tabId: number) => void;
  persistPaneRecord: (pane: PersistedPaneRecord) => Promise<unknown>;
  persistedPaneFor: (
    workspaceId: string,
    paneIndex: number,
  ) => WorkspaceSelectionPane | undefined;
  buildPaneRecord: (
    workspaceId: string,
    paneIndex: number,
    workingFolder: string | null,
    lastCommand: string | null,
    autoLaunch: boolean,
    existingPane?: WorkspaceSelectionPane,
  ) => PersistedPaneRecord;
  saveRecentWorkspace: (workspace: WorkspaceRecord) => void;
  scheduleWorkspacePaneSessionSync: (workspaceId: string, cwd: string | null) => void;
  alert?: (message: string) => void;
};

export type ImportAgentSessionInput = {
  session: ImportableAgentSession;
  workspaceId: string | null;
  tabsRef: { current: Tab[] };
  appendTerminalPane: (
    tabId: number,
    cwd: string | undefined,
    initialCommand: string,
  ) => { paneTree: unknown } | null;
  updateCanvasDiagram: (tabId: number, diagram: ArchitectureDiagram) => void;
  setActiveId: (tabId: number) => void;
  persistPaneRecord: (pane: PersistedPaneRecord) => Promise<unknown>;
  persistedPaneFor: (
    workspaceId: string,
    paneIndex: number,
  ) => WorkspaceSelectionPane | undefined;
  buildPaneRecord: (
    workspaceId: string,
    paneIndex: number,
    workingFolder: string | null,
    lastCommand: string | null,
    autoLaunch: boolean,
    existingPane?: WorkspaceSelectionPane,
    explicitNativeSessionId?: string | null,
  ) => PersistedPaneRecord;
  saveRecentWorkspace: (workspace: WorkspaceRecord) => void;
  scheduleWorkspacePaneSessionSync: (workspaceId: string, cwd: string | null) => void;
  alert: (message: string) => void;
};

type PersistedRecentWorkspaceRecord = WorkspaceItem & {
  workingFolder: string;
  updatedAt: number;
};

function workspaceAccentForIndex(index: number): string {
  return (
    WORKSPACE_ACCENT_COLORS[index % WORKSPACE_ACCENT_COLORS.length] ??
    DEFAULT_WORKSPACE_ACCENT_COLOR
  );
}

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
      await invoke("db_save_pane", { pane });
    },
    [setPersistedPaneRecord],
  );

  const saveRecentWorkspace = useCallback((workspace: WorkspaceItem) => {
    if (!workspace.workingFolder) return;
    const recent = {
      id: workspace.id,
      name: workspace.name,
      count: workspace.count,
      accentColor: workspace.accentColor,
      workingFolder: workspace.workingFolder,
      updatedAt: Date.now(),
    };
    setRecentWorkspaces((current) =>
      [recent, ...current.filter((item) => item.id !== recent.id)].slice(0, 6),
    );
    void invoke("db_save_recent_workspace", { workspace: recent }).catch((error) => {
      console.error("Failed to save recent workspace to SQLite:", error);
    });
  }, []);

  const renameWorkspace = useCallback(
    (workspaceId: string, name: string) => {
      let nextName = name.trim();
      if (!nextName) return;
      const existingNames = new Set(
        workspaces
          .filter((workspace) => workspace.id !== workspaceId)
          .map((workspace) => workspace.name.toLowerCase()),
      );
      if (existingNames.has(nextName.toLowerCase())) {
        let suffix = 1;
        while (existingNames.has(`${nextName} (${suffix})`.toLowerCase())) {
          suffix += 1;
        }
        nextName = `${nextName} (${suffix})`;
      }
      setWorkspaces((current) =>
        current.map((workspace) => {
          if (workspace.id !== workspaceId) return workspace;
          if (workspace.tabId !== null) updateTab(workspace.tabId, { title: nextName });
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
    [updateTab, workspaces],
  );

  const changeWorkspaceColor = useCallback((workspaceId: string, accentColor: string) => {
    const nextAccentColor = normalizeWorkspaceAccentColor(accentColor);
    setWorkspaces((current) =>
      current.map((workspace) => {
        if (workspace.id !== workspaceId || workspace.accentColor === nextAccentColor) {
          return workspace;
        }
        const updated = { ...workspace, accentColor: nextAccentColor, updatedAt: Date.now() };
        void invoke("db_save_workspace", { workspace: updated }).catch((error) =>
          console.error("Failed to save workspace color to SQLite:", error),
        );
        return updated;
      }),
    );
  }, []);

  const reorderWorkspaces = useCallback(
    (draggedId: string, targetId: string, position: "before" | "after") => {
      setWorkspaces((current) => {
        const fromIndex = current.findIndex((item) => item.id === draggedId);
        const toIndex = current.findIndex((item) => item.id === targetId);
        if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return current;
        const next = [...current];
        const [dragged] = next.splice(fromIndex, 1);
        let insertAt = next.findIndex((item) => item.id === targetId);
        if (position === "after") insertAt += 1;
        next.splice(insertAt, 0, dragged);
        const reordered = next.map((item, index) => ({ ...item, displayOrder: index }));
        void invoke("db_reorder_workspaces", {
          orders: reordered.map((item) => [item.id, item.displayOrder]),
        }).catch((error) =>
          console.error("Failed to save reordered workspaces to SQLite:", error),
        );
        return reordered;
      });
    },
    [],
  );

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
        const provider = detectCliAgent(command);
        if (!provider) return false;
        const tabs = input.tabsRef.current.filter(
          (tab) =>
            tab.kind === "agent-chat" &&
            (tab.id === workspace.tabId || workspace.agentTabIds?.includes(tab.id)),
        );
        if (tabs.length >= 12) return false;
        const index = tabs.length + 1;
        const chatId = `${workspace.id}:chat:${index}`;
        const tabId = input.newAgentChatTab({
          title: `${workspace.name} · ${index}`,
          provider,
          cwd: workspace.workingFolder ?? "",
          nativeSessionId: null,
          chatId,
        });
        const updated: WorkspaceRecord = {
          ...workspace,
          tabId: workspace.tabId ?? tabId,
          agentTabIds: [...(workspace.agentTabIds ?? []), tabId],
          agentProviders: [...(workspace.agentProviders ?? []), provider],
          agentSessionIds: [...(workspace.agentSessionIds ?? []), null],
          agentChatIds: [...(workspace.agentChatIds ?? []), chatId],
          count: tabs.length + 1,
          updatedAt: Date.now(),
        };
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
      const updated: WorkspaceRecord = {
        ...workspace,
        count: leafIds(paneTree).length,
        paneLayout: JSON.stringify(paneTree),
        updatedAt: Date.now(),
      };
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
      const updated: WorkspaceRecord = {
        ...workspace,
        count: leafIds(paneTree).length,
        paneLayout: JSON.stringify(paneTree),
        updatedAt: Date.now(),
      };
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
    async (input: CreateWorkspaceInput): Promise<WorkspaceRecord | null> => {
      const fallbackName = input.nextWorkspaceName(workspaces);
      if (fallbackName === null) {
        input.alert("Workspace limit reached (99).");
        return null;
      }
      const workspaceMode = input.workspaceMode ?? "standard";
      const initialCommands = input.initialCommands ?? [];
      const name = input.requestedName?.trim() || fallbackName;
      const effectiveWorkingFolder =
        input.workingFolder ?? input.inheritedCwd ?? null;
      const paneLaunchPlan =
        initialCommands.length > 0 || workspaceMode === "canvas"
          ? Array.from({ length: input.terminalCount }, (_, paneIndex) => ({
              paneIndex,
              workingFolder: effectiveWorkingFolder,
              lastCommand: initialCommands[paneIndex] ?? null,
              autoLaunch: Boolean(initialCommands[paneIndex]),
            }))
          : undefined;
      const canvasDiagram =
        workspaceMode === "canvas"
          ? buildCanvasWorkspaceDiagram(
              input.terminalCount,
              effectiveWorkingFolder,
              initialCommands,
            )
          : null;
      const workspaceId = `workspace-tab-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}`;
      const agentProviders =
        workspaceMode === "agent"
          ? (input.workspaceAgents?.length
              ? input.workspaceAgents
              : input.workspaceAgent
                ? [input.workspaceAgent]
                : []
            ).slice(0, 12)
          : [];
      const agentChatIds =
        workspaceMode === "agent"
          ? agentProviders.map((_, index) => `${workspaceId}:chat:${index + 1}`)
          : [];
      const agentTabIds =
        workspaceMode === "agent"
          ? agentProviders.map((provider, index) =>
              input.newAgentChatTab({
                title: `${name} · ${index + 1}`,
                provider,
                cwd: effectiveWorkingFolder ?? "",
                nativeSessionId: null,
                chatId: agentChatIds[index],
                initialDraft: index === 0 ? input.initialAgentDraft : undefined,
                initialHistoryAttachments:
                  index === 0 ? input.initialHistoryAttachments : undefined,
              }),
            )
          : [];
      const tabId =
        workspaceMode === "canvas"
          ? null
          : workspaceMode === "agent"
            ? agentTabIds[0] ?? null
            : input.newWorkspaceTab(
                effectiveWorkingFolder ?? undefined,
                input.terminalCount,
                paneLaunchPlan,
                null,
                name,
              );
      const canvasTabId = canvasDiagram
        ? input.newArchitectureTab(canvasDiagram, name)
        : null;
      const now = Date.now();
      const workspace: WorkspaceRecord = {
        id: workspaceId,
        name,
        count: workspaceMode === "agent" ? agentTabIds.length : input.terminalCount,
        accentColor: normalizeWorkspaceAccentColor(
          input.requestedColor,
          workspaceAccentForIndex(workspaces.length),
        ),
        workingFolder: effectiveWorkingFolder,
        createdAt: now,
        updatedAt: now,
        displayOrder: workspaces.length,
        paneLayout: canvasDiagram
          ? serializeCanvasWorkspaceDiagram(canvasDiagram)
          : null,
        tabId: workspaceMode === "canvas" ? null : tabId,
        canvasTabId,
        workspaceMode,
        agentProvider: workspaceMode === "agent" ? input.workspaceAgent ?? null : null,
        agentSessionId: null,
        agentTabIds,
        agentProviders,
        agentSessionIds:
          workspaceMode === "agent" ? agentProviders.map(() => null) : [],
        agentChatIds,
      };

      saveRecentWorkspace(workspace);
      if (paneLaunchPlan) {
        await Promise.all(
          paneLaunchPlan.map((pane) =>
            persistPaneRecord({
              workspaceId,
              paneIndex: pane.paneIndex,
              workingFolder: pane.workingFolder,
              lastCommand: pane.lastCommand,
              autoLaunch: pane.autoLaunch,
              agentProvider: pane.lastCommand
                ? detectCliAgent(pane.lastCommand)
                : null,
              nativeSessionId: null,
            }),
          ),
        );
      }
      try {
        await invoke("db_save_workspace", { workspace });
      } catch (error) {
        console.error("Failed to save workspace to SQLite:", error);
      }
      setWorkspaces((current) => [...current, workspace]);
      input.closeSetup();
      const activatedTabId = tabId ?? canvasTabId;
      if (activatedTabId !== null) input.setActiveId(activatedTabId);
      const bootstrapTab = input.tabs.find(
        (tab) => tab.id === 1 && tab.title === "shell",
      );
      if (bootstrapTab && input.tabs.length > 1) input.closeTab(bootstrapTab.id);
      return workspace;
    },
    [persistPaneRecord, saveRecentWorkspace, workspaces],
  );

  useEffect(() => {
    void invoke<PersistedWorkspaceRecord[]>("db_list_workspaces")
      .then((list) => {
        const hydrated = list.map((workspace, index): WorkspaceRecord => ({
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
                : "standard",
          agentProvider: workspace.agentProvider ?? null,
          agentSessionId: workspace.agentSessionId ?? null,
          agentTabIds: [],
          agentProviders: workspace.agentProviders ?? [],
          agentSessionIds: workspace.agentSessionIds ?? [],
          agentChatIds: workspace.agentChatIds ?? [],
        }));
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
          list.map((workspace, index) => ({
            ...workspace,
            accentColor: normalizeWorkspaceAccentColor(
              workspace.accentColor,
              workspaceAccentForIndex(index),
            ),
          })),
        );
      })
      .catch((error) => {
        console.error("Failed to load recent workspaces from SQLite:", error);
      });
  }, []);

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

function buildCanvasWorkspaceDiagram(
  terminalCount: number,
  workingFolder: string | null,
  initialCommands: string[],
): ArchitectureDiagram {
  const columns = terminalCount === 1 ? 1 : 2;
  const terminalWidth = 620;
  const terminalHeight = 400;
  const gap = 48;
  return {
    nodes: Array.from({ length: terminalCount }, (_, index) => ({
      id: `workspace-terminal-${index + 1}`,
      kind: "terminal" as const,
      label: `Terminal ${index + 1}`,
      technology: "",
      x: 96 + (index % columns) * (terminalWidth + gap),
      y: 96 + Math.floor(index / columns) * (terminalHeight + gap),
      width: terminalWidth,
      height: terminalHeight,
      ...(workingFolder ? { cwd: workingFolder } : {}),
      ...(initialCommands[index]
        ? { initialCommand: initialCommands[index] }
        : {}),
      terminalChromeVersion: 2 as const,
    })),
    edges: [],
  };
}

import type { ArchitectureDiagram, Tab } from "@/modules/tabs";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { WorkspaceItem, WorkspaceMode } from "@/modules/workspaces";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";
import type { ImportableAgentSession } from "@/modules/workspaces";
import type { WorkspaceSelectionPane } from "./useWorkspaceSelection";

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

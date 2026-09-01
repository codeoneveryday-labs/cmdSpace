import { useCallback } from "react";

import type { ArchitectureDiagram } from "@/modules/tabs";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";

export type WorkspaceSelectionPane = {
  paneIndex: number;
  workingFolder: string | null;
  autoLaunch: boolean;
  lastCommand: string | null;
  agentProvider?: CliAgent | null;
  nativeSessionId?: string | null;
};

export type WorkspaceSelectionRecord = {
  id: string;
  name: string;
  count: number;
  workingFolder: string | null;
  paneLayout: string | null;
  tabId: number | null;
  canvasTabId: number | null;
  workspaceMode?: "standard" | "canvas" | "agent";
  agentProvider?: CliAgent | null;
  agentSessionId?: string | null;
  agentProviders?: CliAgent[] | null;
  agentSessionIds?: Array<string | null> | null;
  agentChatIds?: string[] | null;
  agentTabIds?: number[];
};

export type WorkspaceSelectionTab = {
  id: number;
  kind: string;
  diagram?: ArchitectureDiagram;
};

export type WorkspaceSelectionPort<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
> = {
  workspaces: readonly TWorkspace[];
  tabs: readonly TTab[];
  closeWorkspaceSetup: () => void;
  saveRecentWorkspace: (workspace: TWorkspace) => void;
  activateTab: (tabId: number) => void;
  updateCanvasTabDiagram: (tabId: number, diagram: ArchitectureDiagram) => void;
  persistCanvasDiagram?: (tabId: number, diagram: ArchitectureDiagram) => void;
  isSelectionCurrent?: () => boolean;
  createCanvasTab: (diagram: ArchitectureDiagram, title: string) => number;
  createAgentChatTab: (input: {
    title: string;
    provider: CliAgent;
    cwd: string;
    nativeSessionId: string | null;
    chatId?: string;
  }) => number;
  createWorkspaceTab: (
    workingFolder: string | undefined,
    count: number,
    panes?: WorkspaceSelectionPane[],
    paneLayout?: string | null,
    title?: string,
  ) => number;
  replaceWorkspace: (
    workspaceId: string,
    patch: Partial<Pick<TWorkspace, "tabId" | "canvasTabId" | "agentTabIds" | "agentProviders" | "agentSessionIds" | "agentChatIds">>,
  ) => void;
  listWorkspacePanes: (workspaceId: string) => Promise<WorkspaceSelectionPane[]>;
  resolvePaneResumeCommands?: (
    workspaceId: string,
    panes: WorkspaceSelectionPane[],
    workspaceCwd: string | null,
  ) => Promise<WorkspaceSelectionPane[]>;
  parsePersistedCanvasDiagram?: (
    paneLayout: string | null | undefined,
  ) => ArchitectureDiagram | null;
  buildCanvasWorkspaceDiagram: (
    terminalCount: number,
    workingFolder: string | null,
    initialCommands: string[],
  ) => ArchitectureDiagram;
  onLoadCanvasWorkspacePanesError: (error: unknown) => void;
  onLoadWorkspacePanesError: (error: unknown) => void;
};

import {
  selectWorkspace,
} from "./workspaceSelectionRestoration";
export { selectWorkspace };
export function createWorkspaceSelectionHandler<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(port: WorkspaceSelectionPort<TWorkspace, TTab>) {
  return (workspaceId: string, isCurrent?: () => boolean) =>
    selectWorkspace(port, workspaceId, isCurrent);
}

export function useWorkspaceSelection<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(port: WorkspaceSelectionPort<TWorkspace, TTab>) {
  return useCallback(createWorkspaceSelectionHandler(port), [port]);
}

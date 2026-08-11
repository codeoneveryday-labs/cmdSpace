import { useCallback } from "react";

import { parseCanvasWorkspaceDiagram } from "@/modules/architecture";
import type { ArchitectureDiagram } from "@/modules/tabs";

export type WorkspaceSelectionPane = {
  paneIndex: number;
  workingFolder: string | null;
  autoLaunch: boolean;
  lastCommand: string | null;
};

export type WorkspaceSelectionRecord = {
  id: string;
  name: string;
  count: number;
  workingFolder: string | null;
  paneLayout: string | null;
  tabId: number | null;
  canvasTabId: number | null;
  workspaceMode?: "standard" | "canvas";
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
  createCanvasTab: (diagram: ArchitectureDiagram, title: string) => number;
  createWorkspaceTab: (
    workingFolder: string | undefined,
    count: number,
    panes?: WorkspaceSelectionPane[],
    paneLayout?: string | null,
  ) => number;
  replaceWorkspace: (
    workspaceId: string,
    patch: Partial<Pick<TWorkspace, "tabId" | "canvasTabId">>,
  ) => void;
  listWorkspacePanes: (workspaceId: string) => Promise<WorkspaceSelectionPane[]>;
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

function countTerminalNodes(diagram: ArchitectureDiagram | undefined): number {
  return (
    diagram?.nodes.filter((node) => node.kind === "terminal").length ?? 0
  );
}

function restoreCanvasWorkspace<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(
  port: WorkspaceSelectionPort<TWorkspace, TTab>,
  workspace: TWorkspace,
  workspaceId: string,
): Promise<void> | void {
  const canvasTab = port.tabs.find((tab) => tab.id === workspace.canvasTabId);
  if (
    workspace.canvasTabId !== null &&
    countTerminalNodes(
      canvasTab?.kind === "architecture" ? canvasTab.diagram : undefined,
    ) >= workspace.count
  ) {
    port.activateTab(workspace.canvasTabId);
    return;
  }

  const persistedDiagram =
    port.parsePersistedCanvasDiagram?.(workspace.paneLayout) ??
    parseCanvasWorkspaceDiagram(workspace.paneLayout);
  if (persistedDiagram) {
    const canvasTabId = workspace.canvasTabId;
    if (canvasTabId !== null) {
      port.updateCanvasTabDiagram(canvasTabId, persistedDiagram);
      port.activateTab(canvasTabId);
      return;
    }
    const createdCanvasTabId = port.createCanvasTab(
      persistedDiagram,
      `${workspace.name} Canvas`,
    );
    port.replaceWorkspace(workspaceId, { canvasTabId: createdCanvasTabId });
    return;
  }

  return port
    .listWorkspacePanes(workspaceId)
    .then((panes) => {
      const diagram = port.buildCanvasWorkspaceDiagram(
        workspace.count,
        workspace.workingFolder,
        panes.map((pane) => (pane.autoLaunch ? (pane.lastCommand ?? "") : "")),
      );
      const canvasTabId = workspace.canvasTabId;
      if (canvasTabId !== null) {
        port.updateCanvasTabDiagram(canvasTabId, diagram);
        port.activateTab(canvasTabId);
        return;
      }
      const createdCanvasTabId = port.createCanvasTab(
        diagram,
        `${workspace.name} Canvas`,
      );
      port.replaceWorkspace(workspaceId, { canvasTabId: createdCanvasTabId });
    })
    .catch((error) => {
      port.onLoadCanvasWorkspacePanesError(error);
      const diagram = port.buildCanvasWorkspaceDiagram(
        workspace.count,
        workspace.workingFolder,
        [],
      );
      const canvasTabId = workspace.canvasTabId;
      if (canvasTabId !== null) {
        port.updateCanvasTabDiagram(canvasTabId, diagram);
        port.activateTab(canvasTabId);
        return;
      }
      const createdCanvasTabId = port.createCanvasTab(
        diagram,
        `${workspace.name} Canvas`,
      );
      port.replaceWorkspace(workspaceId, { canvasTabId: createdCanvasTabId });
    });
}

function restoreStandardWorkspace<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(
  port: WorkspaceSelectionPort<TWorkspace, TTab>,
  workspace: TWorkspace,
  workspaceId: string,
): Promise<void> | void {
  if (workspace.tabId !== null) {
    port.activateTab(workspace.tabId);
    return;
  }

  return port
    .listWorkspacePanes(workspaceId)
    .then((panes) => {
      const tabId = port.createWorkspaceTab(
        workspace.workingFolder ?? undefined,
        workspace.count,
        panes,
        workspace.paneLayout,
      );
      port.replaceWorkspace(workspaceId, { tabId });
    })
    .catch((error) => {
      port.onLoadWorkspacePanesError(error);
      const tabId = port.createWorkspaceTab(
        workspace.workingFolder ?? undefined,
        workspace.count,
        undefined,
        workspace.paneLayout,
      );
      port.replaceWorkspace(workspaceId, { tabId });
    });
}

export async function selectWorkspace<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(
  port: WorkspaceSelectionPort<TWorkspace, TTab>,
  workspaceId: string,
): Promise<void> {
  const workspace = port.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return;

  port.closeWorkspaceSetup();
  port.saveRecentWorkspace(workspace);

  if (workspace.workspaceMode === "canvas") {
    await restoreCanvasWorkspace(port, workspace, workspaceId);
    return;
  }

  await restoreStandardWorkspace(port, workspace, workspaceId);
}

export function useWorkspaceSelection<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(port: WorkspaceSelectionPort<TWorkspace, TTab>) {
  return useCallback(
    (workspaceId: string) => {
      void selectWorkspace(port, workspaceId);
    },
    [port],
  );
}

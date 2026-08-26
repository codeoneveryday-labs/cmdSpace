import { useCallback } from "react";

import { parseCanvasWorkspaceDiagram } from "@/modules/architecture";
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
    patch: Partial<Pick<TWorkspace, "tabId" | "canvasTabId">>,
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

function countTerminalNodes(diagram: ArchitectureDiagram | undefined): number {
  return (
    diagram?.nodes.filter((node) => node.kind === "terminal").length ?? 0
  );
}

function selectionIsCurrent<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(port: WorkspaceSelectionPort<TWorkspace, TTab>): boolean {
  return port.isSelectionCurrent?.() ?? true;
}

function buildCanvasDiagramFromPanes<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(
  port: WorkspaceSelectionPort<TWorkspace, TTab>,
  workspace: TWorkspace,
  panes: WorkspaceSelectionPane[],
): ArchitectureDiagram {
  return port.buildCanvasWorkspaceDiagram(
    workspace.count,
    workspace.workingFolder,
    panes.map((pane) => (pane.autoLaunch ? (pane.lastCommand ?? "") : "")),
  );
}

function updateCanvasDiagramCommands(
  diagram: ArchitectureDiagram,
  panes: WorkspaceSelectionPane[],
): ArchitectureDiagram {
  let terminalIndex = 0;
  const nodes = diagram.nodes.map((node) => {
    if (node.kind !== "terminal") return node;
    const pane = panes[terminalIndex++];
    if (!pane) return node;
    const command = pane.autoLaunch ? pane.lastCommand ?? "" : "";
    if (command) return { ...node, initialCommand: command };
    const { initialCommand: _initialCommand, ...withoutCommand } = node;
    return withoutCommand;
  });
  return { ...diagram, nodes };
}

function reconcileCanvasDiagramInBackground<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(
  port: WorkspaceSelectionPort<TWorkspace, TTab>,
  workspaceId: string,
  workspaceCwd: string | null,
  tabId: number,
  diagram: ArchitectureDiagram,
) {
  if (!port.resolvePaneResumeCommands) return;
  void port
    .listWorkspacePanes(workspaceId)
    .then((panes) =>
      port.resolvePaneResumeCommands!(workspaceId, panes, workspaceCwd).then(
        (resolvedPanes) => ({
          panes,
          resolvedPanes: resolvedPanes.length > 0 ? resolvedPanes : panes,
        }),
      ),
    )
    .then(({ panes, resolvedPanes }) => {
      const nextDiagram = updateCanvasDiagramCommands(diagram, resolvedPanes);
      const changed = nextDiagram.nodes.some((node, index) => {
        const previous = diagram.nodes[index];
        return node.kind === "terminal" &&
          previous?.kind === "terminal" &&
          node.initialCommand !== previous.initialCommand;
      });
      if (!changed && panes.length === 0) return;
      port.updateCanvasTabDiagram(tabId, nextDiagram);
      port.persistCanvasDiagram?.(tabId, nextDiagram);
    })
    .catch((error) => port.onLoadCanvasWorkspacePanesError(error));
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
    if (!selectionIsCurrent(port)) return;
    port.activateTab(workspace.canvasTabId);
    if (canvasTab?.kind === "architecture" && canvasTab.diagram) {
      reconcileCanvasDiagramInBackground(
        port,
        workspaceId,
        workspace.workingFolder,
        workspace.canvasTabId,
        canvasTab.diagram,
      );
    }
    return;
  }

  const persistedDiagram =
    port.parsePersistedCanvasDiagram?.(workspace.paneLayout) ??
    parseCanvasWorkspaceDiagram(workspace.paneLayout);
  if (persistedDiagram) {
    if (!selectionIsCurrent(port)) return;
    const canvasTabId = workspace.canvasTabId;
    if (canvasTabId !== null) {
      port.updateCanvasTabDiagram(canvasTabId, persistedDiagram);
      port.activateTab(canvasTabId);
      reconcileCanvasDiagramInBackground(
        port,
        workspaceId,
        workspace.workingFolder,
        canvasTabId,
        persistedDiagram,
      );
      return;
    }
    const createdCanvasTabId = port.createCanvasTab(
      persistedDiagram,
      workspace.name,
    );
    port.replaceWorkspace(workspaceId, { canvasTabId: createdCanvasTabId });
    reconcileCanvasDiagramInBackground(
      port,
      workspaceId,
      workspace.workingFolder,
      createdCanvasTabId,
      persistedDiagram,
    );
    return;
  }

  return port
    .listWorkspacePanes(workspaceId)
    .then((panes) => {
      if (!selectionIsCurrent(port)) return;
      const diagram = buildCanvasDiagramFromPanes(port, workspace, panes);
      const canvasTabId = workspace.canvasTabId;
      if (canvasTabId !== null) {
        port.updateCanvasTabDiagram(canvasTabId, diagram);
        port.activateTab(canvasTabId);
        if (!port.resolvePaneResumeCommands) return;
        void port
          .resolvePaneResumeCommands(workspaceId, panes, workspace.workingFolder)
          .then((resolvedPanes) => {
            const reconciledDiagram = buildCanvasDiagramFromPanes(
              port,
              workspace,
              resolvedPanes.length > 0 ? resolvedPanes : panes,
            );
            port.updateCanvasTabDiagram(canvasTabId, reconciledDiagram);
            port.persistCanvasDiagram?.(canvasTabId, reconciledDiagram);
          })
          .catch((error) => {
            port.onLoadCanvasWorkspacePanesError(error);
          });
        return;
      }
    const createdCanvasTabId = port.createCanvasTab(
      diagram,
      workspace.name,
      );
      port.replaceWorkspace(workspaceId, { canvasTabId: createdCanvasTabId });
      if (!port.resolvePaneResumeCommands) return;
      void port
        .resolvePaneResumeCommands(workspaceId, panes, workspace.workingFolder)
        .then((resolvedPanes) => {
          const reconciledDiagram = buildCanvasDiagramFromPanes(
            port,
            workspace,
            resolvedPanes.length > 0 ? resolvedPanes : panes,
          );
          port.updateCanvasTabDiagram(createdCanvasTabId, reconciledDiagram);
          port.persistCanvasDiagram?.(createdCanvasTabId, reconciledDiagram);
        })
        .catch((error) => {
          port.onLoadCanvasWorkspacePanesError(error);
        });
    })
    .catch((error) => {
      if (!selectionIsCurrent(port)) return;
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
        workspace.name,
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
    if (!selectionIsCurrent(port)) return;
    port.activateTab(workspace.tabId);
    return;
  }

  return port
    .listWorkspacePanes(workspaceId)
    .then(async (panes) => {
      if (!selectionIsCurrent(port)) return;
      const resolvedPanes = port.resolvePaneResumeCommands
        ? await port.resolvePaneResumeCommands(workspaceId, panes, workspace.workingFolder)
        : panes;
      const tabId = port.createWorkspaceTab(
        workspace.workingFolder ?? undefined,
        workspace.count,
        resolvedPanes,
        workspace.paneLayout,
        workspace.name,
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
        workspace.name,
      );
      port.replaceWorkspace(workspaceId, { tabId });
    });
}

function restoreAgentWorkspace<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(
  port: WorkspaceSelectionPort<TWorkspace, TTab>,
  workspace: TWorkspace,
  workspaceId: string,
): void {
  if (workspace.tabId !== null) {
    if (!selectionIsCurrent(port)) return;
    port.activateTab(workspace.tabId);
    return;
  }
  if (!workspace.agentProvider || !workspace.workingFolder) return;
  if (!selectionIsCurrent(port)) return;
  const count = Math.max(1, workspace.count);
  const tabIds = Array.from({ length: count }, (_, index) =>
    port.createAgentChatTab({
      title: `${workspace.name} Agent${count > 1 ? ` · ${index + 1}` : ""}`,
      provider: workspace.agentProvider!,
      cwd: workspace.workingFolder!,
      nativeSessionId: index === 0 ? workspace.agentSessionId ?? null : null,
    }),
  );
  const tabId = tabIds[0];
  if (tabId !== undefined) port.replaceWorkspace(workspaceId, { tabId });
}

export async function selectWorkspace<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(
  port: WorkspaceSelectionPort<TWorkspace, TTab>,
  workspaceId: string,
  isCurrent: () => boolean = () => true,
): Promise<void> {
  const selectionPort = { ...port, isSelectionCurrent: isCurrent };
  const workspace = selectionPort.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return;

  selectionPort.closeWorkspaceSetup();
  selectionPort.saveRecentWorkspace(workspace);

  if (workspace.workspaceMode === "canvas") {
    await restoreCanvasWorkspace(selectionPort, workspace, workspaceId);
    return;
  }

  if (workspace.workspaceMode === "agent") {
    restoreAgentWorkspace(selectionPort, workspace, workspaceId);
    return;
  }

  await restoreStandardWorkspace(selectionPort, workspace, workspaceId);
}

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

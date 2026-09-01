import { parseCanvasWorkspaceDiagram } from "@/modules/architecture";
import type { ArchitectureDiagram } from "@/modules/tabs";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type {
  WorkspaceSelectionPane,
  WorkspaceSelectionPort,
  WorkspaceSelectionRecord,
  WorkspaceSelectionTab,
} from "./useWorkspaceSelection";

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

export function restoreCanvasWorkspace<
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

export function restoreStandardWorkspace<
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
      if (!selectionIsCurrent(port)) return;
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

export async function restoreAgentWorkspace<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(
  port: WorkspaceSelectionPort<TWorkspace, TTab>,
  workspace: TWorkspace,
  workspaceId: string,
): Promise<void> {
  if (workspace.tabId !== null) {
    if (!selectionIsCurrent(port)) return;
    port.activateTab(workspace.tabId);
    return;
  }
  if (!workspace.agentProvider || !workspace.workingFolder) return;
  if (!selectionIsCurrent(port)) return;
  const count = Math.max(1, workspace.count);
  const providers = workspace.agentProviders?.length
    ? workspace.agentProviders
    : Array.from({ length: count }, () => workspace.agentProvider).filter(
      (provider): provider is CliAgent => Boolean(provider),
      );
  const usedNativeSessionIds = new Set<string>();
  const chatIds = workspace.agentChatIds?.length
    ? workspace.agentChatIds
    : Array.from({ length: count }, (_, index) => `${workspace.id}:chat:${index + 1}`);
  const usedChatIds = new Set<string>();
  const restoredChats = Array.from({ length: count }, (_, index) => {
    const chatId = chatIds[index] ?? `${workspace.id}:chat:${index + 1}`;
    if (usedChatIds.has(chatId)) return null;
    usedChatIds.add(chatId);
    return {
      index,
      chatId,
      provider: providers[index] ?? workspace.agentProvider!,
      nativeSessionId: (() => {
        const candidate =
          workspace.agentSessionIds?.[index] ??
          (index === 0 ? workspace.agentSessionId ?? null : null);
        if (!candidate || usedNativeSessionIds.has(candidate)) return null;
        usedNativeSessionIds.add(candidate);
        return candidate;
      })(),
    };
  }).filter((chat): chat is {
    index: number;
    chatId: string;
    provider: CliAgent;
    nativeSessionId: string | null;
  } => chat !== null);
  const tabIds = restoredChats.map((chat) =>
    port.createAgentChatTab({
      title: `${workspace.name} Agent${count > 1 ? ` · ${chat.index + 1}` : ""}`,
      provider: chat.provider,
      cwd: workspace.workingFolder!,
      chatId: chat.chatId,
      nativeSessionId: chat.nativeSessionId,
    }),
  );
  const tabId = tabIds[0];
  if (tabId !== undefined) {
    port.replaceWorkspace(workspaceId, {
      tabId,
      agentTabIds: tabIds,
      agentProviders: restoredChats.map((chat) => chat.provider),
      agentSessionIds: restoredChats.map(
        (chat) => workspace.agentSessionIds?.[chat.index] ?? null,
      ),
      agentChatIds: restoredChats.map((chat) => chat.chatId),
    });
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
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
    await restoreAgentWorkspace(selectionPort, workspace, workspaceId);
    return;
  }

  await restoreStandardWorkspace(selectionPort, workspace, workspaceId);
}



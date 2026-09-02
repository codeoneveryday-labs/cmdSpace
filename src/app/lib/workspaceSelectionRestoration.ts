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

const PANE_RECONCILIATION_TIMEOUT_MS = 750;

async function resolvePaneResumeCommandsWithTimeout<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(
  port: WorkspaceSelectionPort<TWorkspace, TTab>,
  workspaceId: string,
  panes: WorkspaceSelectionPane[],
  workspaceCwd: string | null,
): Promise<WorkspaceSelectionPane[]> {
  if (!port.resolvePaneResumeCommands) return panes;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      port.resolvePaneResumeCommands(workspaceId, panes, workspaceCwd),
      new Promise<WorkspaceSelectionPane[]>((resolve) => {
        timeoutId = setTimeout(() => resolve(panes), PANE_RECONCILIATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
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

async function reconcileCanvasDiagram<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(
  port: WorkspaceSelectionPort<TWorkspace, TTab>,
  workspaceId: string,
  workspaceCwd: string | null,
  diagram: ArchitectureDiagram,
): Promise<ArchitectureDiagram> {
  const panes = await port.listWorkspacePanes(workspaceId);
  const resolvedPanes = await resolvePaneResumeCommandsWithTimeout(
    port,
    workspaceId,
    panes,
    workspaceCwd,
  );
  return updateCanvasDiagramCommands(
    diagram,
    resolvedPanes.length > 0 ? resolvedPanes : panes,
  );
}

function canvasDiagramCommandsChanged(
  previous: ArchitectureDiagram,
  next: ArchitectureDiagram,
): boolean {
  return next.nodes.some((node, index) => {
    const prior = previous.nodes[index];
    return node.kind === "terminal" &&
      prior?.kind === "terminal" &&
      node.initialCommand !== prior.initialCommand;
  });
}

export async function restoreCanvasWorkspace<
  TWorkspace extends WorkspaceSelectionRecord,
  TTab extends WorkspaceSelectionTab,
>(
  port: WorkspaceSelectionPort<TWorkspace, TTab>,
  workspace: TWorkspace,
  workspaceId: string,
): Promise<void> {
  const canvasTab = port.tabs.find((tab) => tab.id === workspace.canvasTabId);
  if (
    workspace.canvasTabId !== null &&
    countTerminalNodes(
      canvasTab?.kind === "architecture" ? canvasTab.diagram : undefined,
    ) >= workspace.count
  ) {
    if (!selectionIsCurrent(port)) return;
    if (canvasTab?.kind === "architecture" && canvasTab.diagram) {
      try {
        const reconciledDiagram = await reconcileCanvasDiagram(
          port,
          workspaceId,
          workspace.workingFolder,
          canvasTab.diagram,
        );
        if (!selectionIsCurrent(port)) return;
        if (canvasDiagramCommandsChanged(canvasTab.diagram, reconciledDiagram)) {
          port.updateCanvasTabDiagram(workspace.canvasTabId, reconciledDiagram);
          port.persistCanvasDiagram?.(workspace.canvasTabId, reconciledDiagram);
        }
      } catch (error) {
        port.onLoadCanvasWorkspacePanesError(error);
      }
    }
    if (selectionIsCurrent(port)) port.activateTab(workspace.canvasTabId);
    return;
  }

  const persistedDiagram =
    port.parsePersistedCanvasDiagram?.(workspace.paneLayout) ??
    parseCanvasWorkspaceDiagram(workspace.paneLayout);
  if (persistedDiagram) {
    let reconciledDiagram = persistedDiagram;
    try {
      reconciledDiagram = await reconcileCanvasDiagram(
        port,
        workspaceId,
        workspace.workingFolder,
        persistedDiagram,
      );
    } catch (error) {
      port.onLoadCanvasWorkspacePanesError(error);
    }
    if (!selectionIsCurrent(port)) return;
    const canvasTabId = workspace.canvasTabId;
    if (canvasTabId !== null) {
      port.updateCanvasTabDiagram(canvasTabId, reconciledDiagram);
      port.activateTab(canvasTabId);
      if (canvasDiagramCommandsChanged(persistedDiagram, reconciledDiagram)) {
        port.persistCanvasDiagram?.(canvasTabId, reconciledDiagram);
      }
      return;
    }
    const createdCanvasTabId = port.createCanvasTab(
      reconciledDiagram,
      workspace.name,
    );
    port.replaceWorkspace(workspaceId, { canvasTabId: createdCanvasTabId });
    port.persistCanvasDiagram?.(createdCanvasTabId, reconciledDiagram);
    return;
  }

  try {
    const panes = await port.listWorkspacePanes(workspaceId);
    let resolvedPanes = panes;
    if (port.resolvePaneResumeCommands) {
      resolvedPanes = await resolvePaneResumeCommandsWithTimeout(
        port,
        workspaceId,
        panes,
        workspace.workingFolder,
      );
      if (resolvedPanes.length === 0) resolvedPanes = panes;
    }
    if (!selectionIsCurrent(port)) return;
    const diagram = buildCanvasDiagramFromPanes(port, workspace, resolvedPanes);
    const canvasTabId = workspace.canvasTabId;
    if (canvasTabId !== null) {
      port.updateCanvasTabDiagram(canvasTabId, diagram);
      port.activateTab(canvasTabId);
      port.persistCanvasDiagram?.(canvasTabId, diagram);
      return;
    }
    const createdCanvasTabId = port.createCanvasTab(diagram, workspace.name);
    port.replaceWorkspace(workspaceId, { canvasTabId: createdCanvasTabId });
    port.persistCanvasDiagram?.(createdCanvasTabId, diagram);
  } catch (error) {
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
    const createdCanvasTabId = port.createCanvasTab(diagram, workspace.name);
    port.replaceWorkspace(workspaceId, { canvasTabId: createdCanvasTabId });
  }
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
      let resolvedPanes = panes;
      if (port.resolvePaneResumeCommands) {
        try {
          const reconciled = await resolvePaneResumeCommandsWithTimeout(
            port,
            workspaceId,
            panes,
            workspace.workingFolder,
          );
          if (reconciled.length > 0) resolvedPanes = reconciled;
        } catch (error) {
          port.onLoadWorkspacePanesError(error);
        }
      }
      if (!selectionIsCurrent(port)) return;
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

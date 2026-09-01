import {
  findLeafCwd,
  findLeafLastCommand,
  leafIds,
} from "@/modules/terminal/lib/panes";
import { detectTrackedCliAgent } from "@/modules/terminal/lib/cliAgents";
import type { Tab } from "@/modules/tabs";
import type {
  WorkspaceItem,
  WorkspaceTerminalItem,
} from "@/modules/workspaces";
import type { WorkspaceRecord } from "./useWorkspaceController";
import type { WorkspaceSelectionPane } from "./useWorkspaceSelection";
import type { AgentDisplayState } from "@/modules/terminal/AgentStateDot";

type Input = {
  workspaces: WorkspaceRecord[];
  tabs: Tab[];
  activeId: number;
  activeWorkspaceId: string | null;
  activeWorkspaceTerminals: WorkspaceTerminalItem[];
  persistedWorkspacePanes: Record<string, WorkspaceSelectionPane[]>;
  agentCommands: ReadonlyMap<number, string>;
  respondingLeaves: ReadonlySet<number>;
  requestedLeaves: ReadonlySet<number>;
  blockedLeaves: ReadonlySet<number>;
  completedLeaves: ReadonlySet<number>;
  activeCanvasTerminalIds: ReadonlyMap<number, string>;
  closePaneByLeaf: (leafId: number) => void;
  closeCanvasTerminal: (tabId: number, nodeId: string) => void;
  closeAgentTab: (tabId: number) => void;
};

function terminalState(
  terminal: Pick<WorkspaceTerminalItem, "state">,
): AgentDisplayState | undefined {
  return terminal.state;
}

function aggregateState(
  terminals: WorkspaceTerminalItem[],
): AgentDisplayState | undefined {
  return (
    terminals.find((terminal) => terminalState(terminal) === "blocked")
      ? "blocked"
      : terminals.find((terminal) => terminalState(terminal) === "working")
        ? "working"
        : terminals.find((terminal) => terminalState(terminal) === "done")
          ? "done"
          : undefined
  ) as AgentDisplayState | undefined;
}

function terminalForPane(
  tab: Extract<Tab, { kind: "terminal" }>,
  workspace: WorkspaceRecord,
  leafId: number,
  index: number,
  input: Input,
): WorkspaceTerminalItem {
  const trackedCommand = input.agentCommands.get(leafId);
  const savedCommand = findLeafLastCommand(tab.paneTree, leafId);
  const command = trackedCommand ?? savedCommand;
  const agent = detectTrackedCliAgent(trackedCommand, savedCommand);
  return {
    leafId,
    cwd: findLeafCwd(tab.paneTree, leafId) ?? tab.cwd ?? workspace.workingFolder ?? null,
    label: command ?? (agent ?? `Terminal ${index + 1}`),
    onClose: () => input.closePaneByLeaf(leafId),
    ...(agent ? { agent } : {}),
    active: workspace.id === input.activeWorkspaceId && leafId === tab.activeLeafId,
    responding: input.respondingLeaves.has(leafId),
    completed: input.completedLeaves.has(leafId),
    state: (input.blockedLeaves.has(leafId)
      ? "blocked"
      : input.requestedLeaves.has(leafId) || input.respondingLeaves.has(leafId)
        ? "working"
        : input.completedLeaves.has(leafId)
          ? "done"
          : undefined) as AgentDisplayState | undefined,
  };
}

export function buildActiveTerminalItems(input: {
  tab: Extract<Tab, { kind: "terminal" }> | undefined;
  activeLeafId: number | null;
  agentCommands: ReadonlyMap<number, string>;
  respondingLeaves: ReadonlySet<number>;
  requestedLeaves: ReadonlySet<number>;
  blockedLeaves: ReadonlySet<number>;
  completedLeaves: ReadonlySet<number>;
  closePaneByLeaf: (leafId: number) => void;
}): WorkspaceTerminalItem[] {
  if (!input.tab) return [];
  const tab = input.tab;
  return leafIds(tab.paneTree).map((leafId, index) => {
    const trackedCommand = input.agentCommands.get(leafId);
    const savedCommand = findLeafLastCommand(tab.paneTree, leafId);
    const command = trackedCommand ?? savedCommand;
    const agent = detectTrackedCliAgent(trackedCommand, savedCommand);
    return {
      leafId,
      cwd: findLeafCwd(tab.paneTree, leafId) ?? tab.cwd ?? null,
      label: command ?? (agent ?? `Terminal ${index + 1}`),
      onClose: () => input.closePaneByLeaf(leafId),
      ...(agent ? { agent } : {}),
      active: leafId === input.activeLeafId,
      responding: input.respondingLeaves.has(leafId),
      completed: input.completedLeaves.has(leafId),
      state: (input.blockedLeaves.has(leafId)
        ? "blocked"
        : input.requestedLeaves.has(leafId) || input.respondingLeaves.has(leafId)
          ? "working"
          : input.completedLeaves.has(leafId)
            ? "done"
            : undefined) as AgentDisplayState | undefined,
    };
  });
}

export function countActiveCodingAgents(
  tab: Extract<Tab, { kind: "terminal" }> | undefined,
  agentCommands: ReadonlyMap<number, string>,
): number {
  if (!tab) return 0;
  return leafIds(tab.paneTree).filter((leafId) =>
    Boolean(
      detectTrackedCliAgent(
        agentCommands.get(leafId),
        findLeafLastCommand(tab.paneTree, leafId),
      ),
    ),
  ).length;
}

function terminalsForCanvas(
  workspace: WorkspaceRecord,
  canvasTab: Extract<Tab, { kind: "architecture" }>,
  input: Input,
): WorkspaceTerminalItem[] {
  const activeCanvasId = input.activeCanvasTerminalIds.get(canvasTab.id);
  return (
    canvasTab.diagram?.nodes
      .filter((node) => node.kind === "terminal")
      .map((node, index): WorkspaceTerminalItem => {
        const command = node.initialCommand ?? null;
        const agent = detectTrackedCliAgent(command ?? undefined, command ?? undefined);
        return {
          leafId: -(index + 1),
          cwd: node.cwd ?? workspace.workingFolder ?? null,
          label: command ?? `Terminal ${index + 1}`,
          onClose: () => input.closeCanvasTerminal(canvasTab.id, node.id),
          ...(agent ? { agent } : {}),
          active: node.id === activeCanvasId,
          responding: false,
          completed: false,
        };
      }) ?? []
  );
}

function terminalsForAgentTabs(
  agentTabs: Extract<Tab, { kind: "agent-chat" }>[],
  input: Input,
): WorkspaceTerminalItem[] {
  return agentTabs.map((agentTab, index) => ({
    leafId: -(index + 1),
    cwd: agentTab.cwd,
    tabId: agentTab.id,
    label: agentTab.title,
    onClose: () => input.closeAgentTab(agentTab.id),
    agent: agentTab.provider,
    active: agentTab.id === input.activeId,
    responding: false,
    completed: false,
  }));
}

function terminalsForPersistedPanes(
  workspace: WorkspaceRecord,
  persistedPanes: WorkspaceSelectionPane[],
): WorkspaceTerminalItem[] {
  const count = Math.max(workspace.count, persistedPanes.length);
  return Array.from({ length: count }, (_, index) => {
    const pane = persistedPanes[index];
    const command = pane?.autoLaunch ? pane.lastCommand : null;
    const agent = detectTrackedCliAgent(command ?? undefined, command ?? undefined);
    return {
      leafId: -(index + 1),
      cwd: pane?.workingFolder ?? workspace.workingFolder ?? null,
      label: command ?? (agent ?? `Terminal ${index + 1}`),
      ...(agent ? { agent } : {}),
      active: false,
      responding: false,
      completed: false,
    };
  });
}

export function buildWorkspaceItems(input: Input): WorkspaceItem[] {
  return input.workspaces.map((workspace) => {
    const workspaceTab = input.tabs.find((tab) => tab.id === workspace.tabId);
    const liveWorkingFolder = workspace.workingFolder
      ?? (workspaceTab?.kind === "terminal"
        ? findLeafCwd(workspaceTab.paneTree, workspaceTab.activeLeafId) ?? workspaceTab.cwd ?? null
        : workspaceTab?.kind === "agent-chat" ? workspaceTab.cwd : null);

    if (workspace.id === input.activeWorkspaceId && input.activeWorkspaceTerminals.length > 0) {
      const terminals = input.activeWorkspaceTerminals;
      return {
        ...workspace,
        workingFolder: liveWorkingFolder,
        count: terminals.length,
        terminals,
        responding: terminals.some((terminal) => terminal.responding),
        state: aggregateState(terminals),
      };
    }

    const canvasTab = workspace.canvasTabId === null
      ? undefined
      : input.tabs.find((tab) => tab.id === workspace.canvasTabId);
    if (workspace.workspaceMode === "canvas" && canvasTab?.kind === "architecture") {
      const terminals = terminalsForCanvas(workspace, canvasTab, input);
      return { ...workspace, workingFolder: liveWorkingFolder, count: terminals.length, terminals };
    }

    const agentTabs = input.tabs.filter(
      (tab): tab is Extract<Tab, { kind: "agent-chat" }> =>
        tab.kind === "agent-chat" &&
        (tab.id === workspace.tabId || workspace.agentTabIds?.includes(tab.id) === true),
    );
    if (workspace.workspaceMode === "agent" && agentTabs.length > 0) {
      const terminals = terminalsForAgentTabs(agentTabs, input);
      return { ...workspace, workingFolder: liveWorkingFolder, count: terminals.length, terminals };
    }
    if (workspace.workspaceMode === "agent") {
      return { ...workspace, workingFolder: liveWorkingFolder, count: agentTabs.length, terminals: [] };
    }

    if (!workspaceTab || workspaceTab.kind !== "terminal") {
      const terminals = terminalsForPersistedPanes(
        workspace,
        input.persistedWorkspacePanes[workspace.id] ?? [],
      );
      return terminals.length > 0
        ? { ...workspace, count: terminals.length, terminals }
        : workspace;
    }

    const terminals = leafIds(workspaceTab.paneTree).map((leafId, index) =>
      terminalForPane(workspaceTab, workspace, leafId, index, input),
    );
    return {
      ...workspace,
      count: terminals.length,
      terminals,
      responding: terminals.some((terminal) => terminal.responding),
      state: aggregateState(terminals),
    };
  });
}

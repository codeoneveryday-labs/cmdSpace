import { describe, expect, it, vi } from "vitest";

import type { ArchitectureDiagram } from "@/modules/tabs";

import {
  createWorkspaceSelectionHandler,
  selectWorkspace,
} from "./useWorkspaceSelection";
import type {
  WorkspaceSelectionPane,
  WorkspaceSelectionPort,
  WorkspaceSelectionRecord,
  WorkspaceSelectionTab,
} from "./useWorkspaceSelection";

type TestWorkspace = WorkspaceSelectionRecord & {
  agentProvider?: string | null;
  agentSessionId?: string | null;
};
type TestTab = WorkspaceSelectionTab;

function createPort(
  workspaces: TestWorkspace[],
  tabs: TestTab[],
  overrides: Partial<
    Pick<
      WorkspaceSelectionPort<TestWorkspace, TestTab>,
      | "listWorkspacePanes"
      | "parsePersistedCanvasDiagram"
      | "resolvePaneResumeCommands"
    >
  > = {},
) {
  const closeWorkspaceSetup = vi.fn();
  const saveRecentWorkspace = vi.fn();
  const activateTab = vi.fn();
  const updateCanvasTabDiagram = vi.fn();
  const createCanvasTab = vi.fn(() => 91);
  const createAgentChatTab = vi.fn(() => 92);
  const createWorkspaceTab = vi.fn(() => 42);
  const replaceWorkspace = vi.fn();
  const onLoadCanvasWorkspacePanesError = vi.fn();
  const onLoadWorkspacePanesError = vi.fn();
  const listWorkspacePanes = vi.fn<
    (workspaceId: string) => Promise<WorkspaceSelectionPane[]>
  >(async () => []);
  const parsePersistedCanvasDiagram = vi.fn<
    (paneLayout: string | null | undefined) => ArchitectureDiagram | null
  >(() => null);
  const buildCanvasWorkspaceDiagram = vi.fn<
    (terminalCount: number, workingFolder: string | null, initialCommands: string[]) => ArchitectureDiagram
  >((terminalCount, _workingFolder, initialCommands) => ({
    nodes: Array.from({ length: terminalCount }, (_, index) => ({
      id: `terminal-${index + 1}`,
      kind: "terminal" as const,
      label: `Terminal ${index + 1}`,
      technology: "zsh",
      x: 0,
      y: 0,
      width: 640,
      height: 400,
      ...(initialCommands[index]
        ? { initialCommand: initialCommands[index] }
        : {}),
    })),
    edges: [],
  }));

  return {
    port: {
      workspaces,
      tabs,
      closeWorkspaceSetup,
      saveRecentWorkspace,
      activateTab,
      updateCanvasTabDiagram,
      createCanvasTab,
      createAgentChatTab,
      createWorkspaceTab,
      replaceWorkspace,
      listWorkspacePanes,
      parsePersistedCanvasDiagram,
      buildCanvasWorkspaceDiagram,
      onLoadCanvasWorkspacePanesError,
      onLoadWorkspacePanesError,
      ...overrides,
    } satisfies WorkspaceSelectionPort<TestWorkspace, TestTab>,
    closeWorkspaceSetup,
    saveRecentWorkspace,
    activateTab,
    updateCanvasTabDiagram,
    createCanvasTab,
    createAgentChatTab,
    createWorkspaceTab,
    replaceWorkspace,
    listWorkspacePanes,
    parsePersistedCanvasDiagram,
    buildCanvasWorkspaceDiagram,
    onLoadCanvasWorkspacePanesError,
    onLoadWorkspacePanesError,
  };
}

describe("selectWorkspace", () => {
  it("does not activate a stale workspace selection", async () => {
    const workspace: TestWorkspace = {
      id: "ws-stale",
      name: "Stale",
      count: 1,
      workingFolder: "/repo",
      paneLayout: null,
      tabId: 7,
      canvasTabId: null,
      workspaceMode: "standard",
    };
    const { port, activateTab } = createPort([workspace], []);

    await selectWorkspace(port, workspace.id, () => false);

    expect(activateTab).not.toHaveBeenCalled();
  });

  it("keeps the async selection promise for the workspace open gate", async () => {
    let resolveSelection!: () => void;
    const workspace: TestWorkspace = {
      id: "workspace-01",
      name: "Workspace",
      count: 1,
      workingFolder: "/repo",
      paneLayout: null,
      tabId: null,
      canvasTabId: null,
      workspaceMode: "canvas",
    };
    const { port } = createPort([workspace], [], {
      listWorkspacePanes: () =>
        new Promise<WorkspaceSelectionPane>((resolve) => {
          resolveSelection = () => resolve({
            paneIndex: 0,
            workingFolder: "/repo",
            autoLaunch: false,
            lastCommand: null,
          });
        }).then((pane) => [pane]),
    });
    const handler = createWorkspaceSelectionHandler(port);

    const result = handler(workspace.id);

    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    resolveSelection();
    await result;
  });

  it("activates an already-open standard workspace tab without loading panes", async () => {
    const workspace: TestWorkspace = {
      id: "ws-standard",
      name: "Workspace",
      count: 2,
      workingFolder: "/repo",
      paneLayout: "{\"kind\":\"split\"}",
      tabId: 7,
      canvasTabId: null,
      workspaceMode: "standard",
    };
    const { port, closeWorkspaceSetup, saveRecentWorkspace, activateTab, listWorkspacePanes } =
      createPort([workspace], []);

    await selectWorkspace(port, workspace.id);

    expect(closeWorkspaceSetup).toHaveBeenCalledOnce();
    expect(saveRecentWorkspace).toHaveBeenCalledWith(workspace);
    expect(activateTab).toHaveBeenCalledWith(7);
    expect(listWorkspacePanes).not.toHaveBeenCalled();
  });

  it("restores an agent workspace through the terminal lifecycle", async () => {
    const workspace: TestWorkspace = {
      id: "ws-agent",
      name: "Agent",
      count: 1,
      workingFolder: "/repo",
      paneLayout: null,
      tabId: null,
      canvasTabId: null,
      workspaceMode: "agent",
      agentProvider: "claude",
      agentSessionId: "claude-session",
    };
    const { port, createWorkspaceTab, createCanvasTab, createAgentChatTab, replaceWorkspace } = createPort(
      [workspace],
      [],
    );

    await selectWorkspace(port, workspace.id);

    expect(createWorkspaceTab).not.toHaveBeenCalled();
    expect(createCanvasTab).not.toHaveBeenCalled();
    expect(createAgentChatTab).toHaveBeenCalledWith({
      title: "Agent Agent",
      chatId: "ws-agent:chat:1",
      provider: "claude",
      cwd: "/repo",
      nativeSessionId: "claude-session",
    });
    expect(replaceWorkspace).toHaveBeenCalledWith("ws-agent", {
      tabId: 92,
      agentTabIds: [92],
      agentProviders: ["claude"],
      agentSessionIds: [null],
      agentChatIds: ["ws-agent:chat:1"],
    });
  });

  it("does not create a fallback tab from a stale standard-workspace request", async () => {
    const workspace: TestWorkspace = {
      id: "ws-stale-fallback",
      name: "Stale fallback",
      count: 1,
      workingFolder: "/repo",
      paneLayout: null,
      tabId: null,
      canvasTabId: null,
      workspaceMode: "standard",
    };
    const { port, createWorkspaceTab, onLoadWorkspacePanesError } = createPort(
      [workspace],
      [],
      {
        listWorkspacePanes: vi.fn(async () => {
          throw new Error("database unavailable");
        }),
      },
    );

    await selectWorkspace(port, workspace.id, () => false);

    expect(onLoadWorkspacePanesError).not.toHaveBeenCalled();
    expect(createWorkspaceTab).not.toHaveBeenCalled();
  });

  it("keeps agent workspace selection open through a paint frame", async () => {
    vi.useFakeTimers();
    const workspace: TestWorkspace = {
      id: "ws-agent-loading",
      name: "Agent loading",
      count: 1,
      workingFolder: "/repo",
      paneLayout: null,
      tabId: null,
      canvasTabId: null,
      workspaceMode: "agent",
      agentProvider: "cmd",
      agentSessionId: null,
    };
    const { port } = createPort([workspace], []);
    let settled = false;
    const opening = selectWorkspace(port, workspace.id).then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.runAllTimersAsync();
    await opening;
    expect(settled).toBe(true);
    vi.useRealTimers();
  });

  it("restores each agent chat tab with its own provider and native session", async () => {
    const workspace: TestWorkspace = {
      id: "ws-multi-agent",
      name: "Multi Agent",
      count: 2,
      workingFolder: "/repo",
      paneLayout: null,
      tabId: null,
      canvasTabId: null,
      workspaceMode: "agent",
      agentProvider: "codex",
      agentSessionId: "codex-legacy",
      agentProviders: ["codex", "cmd"],
      agentSessionIds: ["codex-session", "cmd-session"],
      agentChatIds: ["ws-multi-agent:chat:1", "ws-multi-agent:chat:2"],
    };
    const { port, createAgentChatTab, replaceWorkspace } = createPort(
      [workspace],
      [],
    );

    await selectWorkspace(port, workspace.id);

    expect(createAgentChatTab).toHaveBeenNthCalledWith(1, {
      title: "Multi Agent Agent · 1",
      chatId: "ws-multi-agent:chat:1",
      provider: "codex",
      cwd: "/repo",
      nativeSessionId: "codex-session",
    });
    expect(createAgentChatTab).toHaveBeenNthCalledWith(2, {
      title: "Multi Agent Agent · 2",
      chatId: "ws-multi-agent:chat:2",
      provider: "cmd",
      cwd: "/repo",
      nativeSessionId: "cmd-session",
    });
    expect(replaceWorkspace).toHaveBeenCalledWith("ws-multi-agent", {
      tabId: 92,
      agentTabIds: [92, 92],
      agentProviders: ["codex", "cmd"],
      agentSessionIds: ["codex-session", "cmd-session"],
      agentChatIds: ["ws-multi-agent:chat:1", "ws-multi-agent:chat:2"],
    });
  });

  it("does not restore one native session into multiple agent tabs", async () => {
    const workspace: TestWorkspace = {
      id: "ws-duplicate-session",
      name: "Duplicate Session",
      count: 2,
      workingFolder: "/repo",
      paneLayout: null,
      tabId: null,
      canvasTabId: null,
      workspaceMode: "agent",
      agentProvider: "codex",
      agentSessionId: "same-session",
      agentProviders: ["codex", "codex"],
      agentSessionIds: ["same-session", "same-session"],
    };
    const { port, createAgentChatTab } = createPort([workspace], []);

    await selectWorkspace(port, workspace.id);

    expect(createAgentChatTab).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ nativeSessionId: "same-session" }),
    );
    expect(createAgentChatTab).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ nativeSessionId: null }),
    );
  });

  it("restores only one tab for duplicate persisted chat ids", async () => {
    const workspace: TestWorkspace = {
      id: "ws-duplicate-chat",
      name: "Duplicate chat",
      count: 2,
      workingFolder: "/repo",
      paneLayout: null,
      tabId: null,
      canvasTabId: null,
      workspaceMode: "agent",
      agentProvider: "codex",
      agentProviders: ["codex", "codex"],
      agentSessionIds: ["shared-session", "shared-session"],
      agentChatIds: ["ws-duplicate-chat:chat:1", "ws-duplicate-chat:chat:1"],
    };
    const { port, createAgentChatTab, replaceWorkspace } = createPort([workspace], []);

    await selectWorkspace(port, workspace.id);

    expect(createAgentChatTab).toHaveBeenCalledTimes(1);
    expect(replaceWorkspace).toHaveBeenCalledWith("ws-duplicate-chat", {
      tabId: 92,
      agentTabIds: [92],
      agentProviders: ["codex"],
      agentSessionIds: ["shared-session"],
      agentChatIds: ["ws-duplicate-chat:chat:1"],
    });
  });

  it("restores a persisted canvas diagram into an existing canvas tab and activates it", async () => {
    const persistedDiagram: ArchitectureDiagram = {
      nodes: [
        {
          id: "terminal-1",
          kind: "terminal",
          label: "Terminal 1",
          technology: "zsh",
          x: 10,
          y: 20,
          width: 640,
          height: 400,
        },
      ],
      edges: [],
    };
    const workspace: TestWorkspace = {
      id: "ws-canvas",
      name: "Canvas",
      count: 2,
      workingFolder: "/repo",
      paneLayout: "{\"kind\":\"architecture-canvas\"}",
      tabId: null,
      canvasTabId: 11,
      workspaceMode: "canvas",
    };
    const canvasTab: TestTab = {
      id: 11,
      kind: "architecture",
      diagram: { nodes: [], edges: [] },
    };
    const parsePersistedCanvasDiagram = vi.fn<
      (paneLayout: string | null | undefined) => ArchitectureDiagram | null
    >(() => persistedDiagram);
    const { port, updateCanvasTabDiagram, activateTab, listWorkspacePanes } =
      createPort([workspace], [canvasTab], {
        parsePersistedCanvasDiagram,
      });

    await selectWorkspace(port, workspace.id);

    expect(parsePersistedCanvasDiagram).toHaveBeenCalledWith(
      workspace.paneLayout,
    );
    expect(updateCanvasTabDiagram).toHaveBeenCalledWith(11, persistedDiagram);
    expect(activateTab).toHaveBeenCalledWith(11);
    expect(listWorkspacePanes).not.toHaveBeenCalled();
  });

  it("activates a canvas workspace from pane metadata before native-session reconciliation finishes", async () => {
    let resolveReconciliation!: (panes: WorkspaceSelectionPane[]) => void;
    const workspace: TestWorkspace = {
      id: "ws-canvas",
      name: "Canvas",
      count: 1,
      workingFolder: "/repo",
      paneLayout: null,
      tabId: null,
      canvasTabId: null,
      workspaceMode: "canvas",
    };
    const storedPane: WorkspaceSelectionPane = {
      paneIndex: 0,
      workingFolder: "/repo",
      autoLaunch: true,
      lastCommand: "claude",
    };
    const reconciledPane: WorkspaceSelectionPane = {
      ...storedPane,
      lastCommand: "codex --resume native-session",
      nativeSessionId: "native-session",
    };
    const { port, createCanvasTab, updateCanvasTabDiagram, buildCanvasWorkspaceDiagram } =
      createPort([workspace], [], {
        listWorkspacePanes: async () => [storedPane],
        resolvePaneResumeCommands: () =>
          new Promise<WorkspaceSelectionPane[]>((resolve) => {
            resolveReconciliation = resolve;
          }),
      });

    let settled = false;
    const result = selectWorkspace(port, workspace.id).then(() => {
      settled = true;
    });

    await Promise.resolve();
    await Promise.resolve();

    await vi.waitFor(() => {
      expect(createCanvasTab).toHaveBeenCalledOnce();
      expect(settled).toBe(true);
    });
    expect(buildCanvasWorkspaceDiagram).toHaveBeenNthCalledWith(1, 1, "/repo", [
      "claude",
    ]);
    expect(updateCanvasTabDiagram).not.toHaveBeenCalled();

    resolveReconciliation([reconciledPane]);
    await result;
    await vi.waitFor(() => {
      expect(updateCanvasTabDiagram).toHaveBeenCalledWith(
        91,
        expect.objectContaining({
          nodes: [
            expect.objectContaining({
              initialCommand: "codex --resume native-session",
            }),
          ],
        }),
      );
    });
    expect(buildCanvasWorkspaceDiagram).toHaveBeenNthCalledWith(2, 1, "/repo", [
      "codex --resume native-session",
    ]);
  });

  it("keeps the standard db pane fallback when pane loading fails", async () => {
    const workspace: TestWorkspace = {
      id: "ws-standard",
      name: "Workspace",
      count: 3,
      workingFolder: "/repo",
      paneLayout: "{\"kind\":\"split\"}",
      tabId: null,
      canvasTabId: null,
      workspaceMode: "standard",
    };
    const { port, createWorkspaceTab, replaceWorkspace, onLoadWorkspacePanesError } =
      createPort([workspace], [], {
        listWorkspacePanes: async () => {
          throw new Error("boom");
        },
      });

    await selectWorkspace(port, workspace.id);

    expect(onLoadWorkspacePanesError).toHaveBeenCalledOnce();
    expect(createWorkspaceTab).toHaveBeenCalledWith(
      "/repo",
      3,
      undefined,
      workspace.paneLayout,
      workspace.name,
    );
    expect(replaceWorkspace).toHaveBeenCalledWith("ws-standard", {
      tabId: 42,
    });
  });
});

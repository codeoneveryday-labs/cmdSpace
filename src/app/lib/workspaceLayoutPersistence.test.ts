import { describe, expect, it, vi } from "vitest";

import type { ArchitectureDiagram } from "@/modules/tabs";
import type { PaneNode } from "@/modules/terminal/lib/panes";
import { serializeCanvasWorkspaceDiagram } from "@/modules/architecture";

import {
  persistCanvasWorkspaceLayout,
  persistTerminalWorkspaceLayout,
} from "./workspaceLayoutPersistence";
import type { WorkspaceLayoutPersistencePort } from "./workspaceLayoutPersistence";

type TestWorkspace = {
  id: string;
  name: string;
  count: number;
  paneLayout: string | null;
  updatedAt: number;
  tabId: number | null;
  canvasTabId: number | null;
};

function createPort(
  workspaces: TestWorkspace[],
): {
  port: WorkspaceLayoutPersistencePort<TestWorkspace>;
  replaceWorkspace: ReturnType<typeof vi.fn>;
  persistWorkspace: ReturnType<typeof vi.fn>;
} {
  const replaceWorkspace = vi.fn(
    (_workspace: TestWorkspace): void => undefined,
  );
  const persistWorkspace = vi.fn(
    (_workspace: TestWorkspace): void => undefined,
  );

  return {
    port: {
      findByTerminalTabId(tabId: number) {
        return workspaces.find((workspace) => workspace.tabId === tabId);
      },
      findByCanvasTabId(tabId: number) {
        return workspaces.find((workspace) => workspace.canvasTabId === tabId);
      },
      replaceWorkspace,
      persistWorkspace,
      now: () => 123_456,
    },
    replaceWorkspace,
    persistWorkspace,
  };
}

const terminalPaneTree: PaneNode = {
  kind: "split",
  id: 99,
  dir: "row",
  children: [
    { kind: "leaf", id: 1, cwd: "/tmp/a" },
    {
      kind: "split",
      id: 100,
      dir: "col",
      children: [
        { kind: "leaf", id: 2, cwd: "/tmp/b" },
        { kind: "leaf", id: 3, cwd: "/tmp/c" },
      ],
    },
  ],
};

const canvasDiagram: ArchitectureDiagram = {
  nodes: [
    {
      id: "terminal-1",
      kind: "terminal",
      label: "Terminal 1",
      technology: "zsh",
      x: 0,
      y: 0,
      width: 640,
      height: 400,
    },
    {
      id: "service-1",
      kind: "service",
      label: "Service 1",
      technology: "node",
      x: 640,
      y: 0,
      width: 320,
      height: 200,
    },
    {
      id: "terminal-2",
      kind: "terminal",
      label: "Terminal 2",
      technology: "zsh",
      x: 0,
      y: 440,
      width: 640,
      height: 400,
    },
  ],
  edges: [],
};

describe("workspace layout persistence", () => {
  it("persists terminal pane layouts using leaf count and raw pane tree JSON", () => {
    const workspace: TestWorkspace = {
      id: "ws-terminal",
      name: "Workspace",
      count: 1,
      paneLayout: null,
      updatedAt: 1,
      tabId: 7,
      canvasTabId: null,
    };
    const { port, replaceWorkspace, persistWorkspace } = createPort([workspace]);

    const updated = persistTerminalWorkspaceLayout(port, {
      tabId: 7,
      paneTree: terminalPaneTree,
    });

    expect(updated).toEqual({
      ...workspace,
      count: 3,
      paneLayout: JSON.stringify(terminalPaneTree),
      updatedAt: 123_456,
    });
    expect(replaceWorkspace).toHaveBeenCalledWith(updated!);
    expect(persistWorkspace).toHaveBeenCalledWith(updated!);
  });

  it("does nothing when a terminal tab is not bound to a workspace", () => {
    const { port, replaceWorkspace, persistWorkspace } = createPort([]);

    const updated = persistTerminalWorkspaceLayout(port, {
      tabId: 7,
      paneTree: terminalPaneTree,
    });

    expect(updated).toBeNull();
    expect(replaceWorkspace).not.toHaveBeenCalled();
    expect(persistWorkspace).not.toHaveBeenCalled();
  });

  it("persists canvas layouts using serialized canvas diagrams and terminal-only counts", () => {
    const workspace: TestWorkspace = {
      id: "ws-canvas",
      name: "Canvas",
      count: 1,
      paneLayout: null,
      updatedAt: 10,
      tabId: null,
      canvasTabId: 9,
    };
    const { port, replaceWorkspace, persistWorkspace } = createPort([workspace]);

    const updated = persistCanvasWorkspaceLayout(port, {
      tabId: 9,
      diagram: canvasDiagram,
    });

    expect(updated).toEqual({
      ...workspace,
      count: 2,
      paneLayout: serializeCanvasWorkspaceDiagram(canvasDiagram),
      updatedAt: 123_456,
    });
    expect(replaceWorkspace).toHaveBeenCalledWith(updated!);
    expect(persistWorkspace).toHaveBeenCalledWith(updated!);
  });

  it("skips canvas persistence when count and serialized layout are unchanged", () => {
    const workspace: TestWorkspace = {
      id: "ws-canvas",
      name: "Canvas",
      count: 2,
      paneLayout: serializeCanvasWorkspaceDiagram(canvasDiagram),
      updatedAt: 10,
      tabId: null,
      canvasTabId: 9,
    };
    const { port, replaceWorkspace, persistWorkspace } = createPort([workspace]);

    const updated = persistCanvasWorkspaceLayout(port, {
      tabId: 9,
      diagram: canvasDiagram,
    });

    expect(updated).toBeNull();
    expect(replaceWorkspace).not.toHaveBeenCalled();
    expect(persistWorkspace).not.toHaveBeenCalled();
  });
});

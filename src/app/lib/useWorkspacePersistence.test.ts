import { describe, expect, it, vi } from "vitest";

import { serializeCanvasWorkspaceDiagram } from "@/modules/architecture";
import type { ArchitectureDiagram } from "@/modules/tabs";
import type { PaneNode } from "@/modules/terminal";

import { createWorkspacePersistence } from "./useWorkspacePersistence";

type TestWorkspace = {
  id: string;
  count: number;
  paneLayout: string | null;
  updatedAt: number;
  tabId: number | null;
  canvasTabId: number | null;
};

const paneTree: PaneNode = {
  kind: "split",
  id: 10,
  dir: "row",
  children: [
    { kind: "leaf", id: 1, cwd: "/tmp/a" },
    { kind: "leaf", id: 2, cwd: "/tmp/b" },
  ],
};

const diagram: ArchitectureDiagram = {
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
      label: "API",
      technology: "node",
      x: 700,
      y: 0,
      width: 320,
      height: 200,
    },
  ],
  edges: [],
};

function createDependencies(workspaces: TestWorkspace[]) {
  const events: string[] = [];
  let current = workspaces;
  const setTerminalPaneTree = vi.fn((tabId: number, nextPaneTree: PaneNode) => {
    events.push(`setTerminalPaneTree:${tabId}:${JSON.stringify(nextPaneTree)}`);
  });
  const updateTab = vi.fn(
    (tabId: number, patch: { diagram: ArchitectureDiagram }) => {
      events.push(`updateTab:${tabId}:${JSON.stringify(patch.diagram)}`);
    },
  );
  const setWorkspaces = vi.fn(
    (updater: (value: TestWorkspace[]) => TestWorkspace[]) => {
      events.push("setWorkspaces");
      current = updater(current);
    },
  );
  const persistWorkspace = vi.fn(async (workspace: TestWorkspace) => {
    events.push(`persistWorkspace:${workspace.id}`);
  });

  return {
    events,
    setTerminalPaneTree,
    updateTab,
    setWorkspaces,
    persistWorkspace,
    dependencies: {
      workspacesRef: {
        get current() {
          events.push("readWorkspaces");
          return current;
        },
      },
      setTerminalPaneTree,
      updateTab,
      setWorkspaces,
      persistWorkspace,
      now: () => 111_222,
    },
  };
}

describe("useWorkspacePersistence", () => {
  it("persists terminal pane trees after updating the pane tree and preserves the raw JSON shape", () => {
    const workspace: TestWorkspace = {
      id: "terminal-workspace",
      count: 1,
      paneLayout: null,
      updatedAt: 5,
      tabId: 7,
      canvasTabId: null,
    };
    const {
      events,
      setWorkspaces,
      persistWorkspace,
      dependencies,
    } = createDependencies([workspace]);

    const persistence = createWorkspacePersistence(dependencies);

    persistence.handleTerminalPaneTreeChange(7, paneTree);

    expect(events.slice(0, 2)).toEqual([
      `setTerminalPaneTree:7:${JSON.stringify(paneTree)}`,
      "readWorkspaces",
    ]);
    expect(setWorkspaces).toHaveBeenCalledTimes(1);
    expect(setWorkspaces.mock.calls[0]?.[0]([workspace])).toEqual([
      {
        ...workspace,
        count: 2,
        paneLayout: JSON.stringify(paneTree),
        updatedAt: 111_222,
      },
    ]);
    expect(persistWorkspace).toHaveBeenCalledWith({
      ...workspace,
      count: 2,
      paneLayout: JSON.stringify(paneTree),
      updatedAt: 111_222,
    });
  });

  it("updates the canvas tab first but skips persistence when the serialized diagram and count are unchanged", () => {
    const serializedDiagram = serializeCanvasWorkspaceDiagram(diagram);
    const workspace: TestWorkspace = {
      id: "canvas-workspace",
      count: 1,
      paneLayout: serializedDiagram,
      updatedAt: 9,
      tabId: null,
      canvasTabId: 8,
    };
    const {
      events,
      updateTab,
      setWorkspaces,
      persistWorkspace,
      dependencies,
    } = createDependencies([workspace]);

    const persistence = createWorkspacePersistence(dependencies);

    persistence.handleArchitectureDiagramChange(8, diagram);

    expect(events.slice(0, 2)).toEqual([
      `updateTab:8:${JSON.stringify(diagram)}`,
      "readWorkspaces",
    ]);
    expect(updateTab).toHaveBeenCalledWith(8, { diagram });
    expect(setWorkspaces).not.toHaveBeenCalled();
    expect(persistWorkspace).not.toHaveBeenCalled();
  });

  it("logs the existing terminal persistence error string when sqlite persistence fails", async () => {
    const workspace: TestWorkspace = {
      id: "terminal-workspace",
      count: 1,
      paneLayout: null,
      updatedAt: 5,
      tabId: 7,
      canvasTabId: null,
    };
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const {
      dependencies,
      persistWorkspace,
    } = createDependencies([workspace]);
    persistWorkspace.mockRejectedValueOnce(new Error("sqlite down"));

    const persistence = createWorkspacePersistence(dependencies);

    persistence.handleTerminalPaneTreeChange(7, paneTree);
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to save terminal pane layout to SQLite:",
      expect.any(Error),
    );

    consoleError.mockRestore();
  });
});

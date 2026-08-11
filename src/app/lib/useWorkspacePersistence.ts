import type { ArchitectureDiagram } from "@/modules/tabs";
import { useCallback } from "react";
import type { PaneNode } from "@/modules/terminal/lib/panes";

import {
  persistCanvasWorkspaceLayout,
  persistTerminalWorkspaceLayout,
  type WorkspaceLayoutRecord,
} from "./workspaceLayoutPersistence";

export type WorkspacePersistenceRecord = WorkspaceLayoutRecord;

type WorkspaceStateSetter<TWorkspace> = (
  updater: (current: TWorkspace[]) => TWorkspace[],
) => void;

export type WorkspacePersistenceDependencies<
  TWorkspace extends WorkspacePersistenceRecord,
> = {
  workspacesRef: { current: TWorkspace[] };
  setTerminalPaneTree: (tabId: number, paneTree: PaneNode) => void;
  updateTab: (tabId: number, patch: { diagram: ArchitectureDiagram }) => void;
  setWorkspaces: WorkspaceStateSetter<TWorkspace>;
  persistWorkspace: (workspace: TWorkspace) => Promise<unknown> | unknown;
  now?: () => number;
};

function handleTerminalPaneTreeChangeImpl<
  TWorkspace extends WorkspacePersistenceRecord,
>(
  dependencies: WorkspacePersistenceDependencies<TWorkspace>,
  tabId: number,
  paneTree: PaneNode,
) {
  dependencies.setTerminalPaneTree(tabId, paneTree);
  persistTerminalWorkspaceLayout(
    {
      findByTerminalTabId: (currentTabId) =>
        dependencies.workspacesRef.current.find(
          (item) => item.tabId === currentTabId,
        ),
      findByCanvasTabId: () => undefined,
      replaceWorkspace: (workspace) => {
        dependencies.setWorkspaces((current) =>
          current.map((item) => (item.id === workspace.id ? workspace : item)),
        );
      },
      persistWorkspace: (workspace) => {
        void Promise.resolve(dependencies.persistWorkspace(workspace)).catch(
          (err) => {
            console.error(
              "Failed to save terminal pane layout to SQLite:",
              err,
            );
          },
        );
      },
      now: dependencies.now ?? Date.now,
    },
    { tabId, paneTree },
  );
}

function handleArchitectureDiagramChangeImpl<
  TWorkspace extends WorkspacePersistenceRecord,
>(
  dependencies: WorkspacePersistenceDependencies<TWorkspace>,
  tabId: number,
  diagram: ArchitectureDiagram,
) {
  dependencies.updateTab(tabId, { diagram });
  persistCanvasWorkspaceLayout(
    {
      findByTerminalTabId: () => undefined,
      findByCanvasTabId: (currentTabId) =>
        dependencies.workspacesRef.current.find(
          (item) => item.canvasTabId === currentTabId,
        ),
      replaceWorkspace: (workspace) => {
        dependencies.setWorkspaces((current) =>
          current.map((item) => (item.id === workspace.id ? workspace : item)),
        );
      },
      persistWorkspace: (workspace) => {
        void Promise.resolve(dependencies.persistWorkspace(workspace)).catch(
          (err) => {
            console.error(
              "Failed to save canvas workspace diagram to SQLite:",
              err,
            );
          },
        );
      },
      now: dependencies.now ?? Date.now,
    },
    { tabId, diagram },
  );
}

export function createWorkspacePersistence<
  TWorkspace extends WorkspacePersistenceRecord,
>(dependencies: WorkspacePersistenceDependencies<TWorkspace>) {
  return {
    handleTerminalPaneTreeChange(tabId: number, paneTree: PaneNode) {
      handleTerminalPaneTreeChangeImpl(dependencies, tabId, paneTree);
    },
    handleArchitectureDiagramChange(
      tabId: number,
      diagram: ArchitectureDiagram,
    ) {
      handleArchitectureDiagramChangeImpl(dependencies, tabId, diagram);
    },
  };
}

export function useWorkspacePersistence<
  TWorkspace extends WorkspacePersistenceRecord,
>(dependencies: WorkspacePersistenceDependencies<TWorkspace>) {
  const handleTerminalPaneTreeChange = useCallback(
    (tabId: number, paneTree: PaneNode) => {
      handleTerminalPaneTreeChangeImpl(dependencies, tabId, paneTree);
    },
    [dependencies],
  );

  const handleArchitectureDiagramChange = useCallback(
    (tabId: number, diagram: ArchitectureDiagram) => {
      handleArchitectureDiagramChangeImpl(dependencies, tabId, diagram);
    },
    [dependencies],
  );

  return {
    handleTerminalPaneTreeChange,
    handleArchitectureDiagramChange,
  };
}

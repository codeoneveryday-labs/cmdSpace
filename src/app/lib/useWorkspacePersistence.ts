import type { ArchitectureDiagram } from "@/modules/tabs";
import { useCallback, useRef } from "react";
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
  persistTerminalPanes?: (workspace: TWorkspace, paneTree: PaneNode) => void;
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
  const workspace = dependencies.workspacesRef.current.find(
    (item) => item.tabId === tabId,
  );
  if (workspace) dependencies.persistTerminalPanes?.(workspace, paneTree);
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
  // Keep the latest dependencies in a ref so the returned callbacks stay
  // referentially stable. The caller passes an object literal that is recreated
  // every render; using it directly in useCallback deps would make the callbacks
  // new every render, which in turn re-triggers ArchitectureCanvas' diagram
  // change effect and causes an infinite update loop (Maximum update depth
  // exceeded) while a canvas workspace is open.
  const dependenciesRef = useRef(dependencies);
  dependenciesRef.current = dependencies;

  const handleTerminalPaneTreeChange = useCallback((tabId: number, paneTree: PaneNode) => {
    handleTerminalPaneTreeChangeImpl(dependenciesRef.current, tabId, paneTree);
  }, []);

  const handleArchitectureDiagramChange = useCallback(
    (tabId: number, diagram: ArchitectureDiagram) => {
      handleArchitectureDiagramChangeImpl(dependenciesRef.current, tabId, diagram);
    },
    [],
  );

  return {
    handleTerminalPaneTreeChange,
    handleArchitectureDiagramChange,
  };
}

import { serializeCanvasWorkspaceDiagram } from "@/modules/architecture";
import type { ArchitectureDiagram } from "@/modules/tabs";
import { leafIds, type PaneNode } from "@/modules/terminal/lib/panes";

export type WorkspaceLayoutRecord = {
  id: string;
  count: number;
  paneLayout: string | null;
  updatedAt: number;
  tabId: number | null;
  canvasTabId: number | null;
};

export type WorkspaceLayoutPersistencePort<
  TWorkspace extends WorkspaceLayoutRecord,
> = {
  findByTerminalTabId: (tabId: number) => TWorkspace | undefined;
  findByCanvasTabId: (tabId: number) => TWorkspace | undefined;
  replaceWorkspace: (workspace: TWorkspace) => void;
  persistWorkspace: (workspace: TWorkspace) => void;
  now: () => number;
};

export function persistTerminalWorkspaceLayout<
  TWorkspace extends WorkspaceLayoutRecord,
>(
  port: WorkspaceLayoutPersistencePort<TWorkspace>,
  input: { tabId: number; paneTree: PaneNode },
): TWorkspace | null {
  const workspace = port.findByTerminalTabId(input.tabId);
  if (!workspace) return null;

  const updated = {
    ...workspace,
    count: leafIds(input.paneTree).length,
    paneLayout: JSON.stringify(input.paneTree),
    updatedAt: port.now(),
  };

  port.replaceWorkspace(updated);
  port.persistWorkspace(updated);
  return updated;
}

export function persistCanvasWorkspaceLayout<
  TWorkspace extends WorkspaceLayoutRecord,
>(
  port: WorkspaceLayoutPersistencePort<TWorkspace>,
  input: { tabId: number; diagram: ArchitectureDiagram },
): TWorkspace | null {
  const workspace = port.findByCanvasTabId(input.tabId);
  if (!workspace) return null;

  const count = input.diagram.nodes.filter(
    (node) => node.kind === "terminal",
  ).length;
  const paneLayout = serializeCanvasWorkspaceDiagram(input.diagram);
  if (workspace.count === count && workspace.paneLayout === paneLayout) {
    return null;
  }

  const updated = {
    ...workspace,
    count,
    paneLayout,
    updatedAt: port.now(),
  };

  port.replaceWorkspace(updated);
  port.persistWorkspace(updated);
  return updated;
}

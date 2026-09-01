import type { WorkspaceItem } from "@/modules/workspaces";
import type { WorkspaceRecord } from "./useWorkspaceController";
import { leafIds, type PaneNode } from "@/modules/terminal/lib/panes";

export function updateWorkspaceFromPaneTree(
  workspace: WorkspaceRecord,
  paneTree: PaneNode,
  updatedAt = Date.now(),
): WorkspaceRecord {
  return {
    ...workspace,
    count: leafIds(paneTree).length,
    paneLayout: JSON.stringify(paneTree),
    updatedAt,
  };
}

export function buildRecentWorkspaceItem(
  workspace: Pick<WorkspaceRecord, "id" | "name" | "count" | "accentColor" | "workingFolder">,
  updatedAt = Date.now(),
): WorkspaceItem | null {
  if (!workspace.workingFolder) return null;
  return {
    id: workspace.id,
    name: workspace.name,
    count: workspace.count,
    accentColor: workspace.accentColor,
    workingFolder: workspace.workingFolder,
    updatedAt,
  };
}

export function uniqueWorkspaceName(
  workspaces: readonly WorkspaceRecord[],
  workspaceId: string,
  requestedName: string,
): string | null {
  const name = requestedName.trim();
  if (!name) return null;
  const existingNames = new Set(
    workspaces
      .filter((workspace) => workspace.id !== workspaceId)
      .map((workspace) => workspace.name.toLowerCase()),
  );
  if (!existingNames.has(name.toLowerCase())) return name;

  let suffix = 1;
  while (existingNames.has(`${name} (${suffix})`.toLowerCase())) suffix += 1;
  return `${name} (${suffix})`;
}

export function reorderWorkspaceRecords(
  workspaces: readonly WorkspaceRecord[],
  draggedId: string,
  targetId: string,
  position: "before" | "after",
): WorkspaceRecord[] | null {
  const fromIndex = workspaces.findIndex((item) => item.id === draggedId);
  const toIndex = workspaces.findIndex((item) => item.id === targetId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return null;

  const next = [...workspaces];
  const [dragged] = next.splice(fromIndex, 1);
  if (!dragged) return null;
  let insertAt = next.findIndex((item) => item.id === targetId);
  if (position === "after") insertAt += 1;
  next.splice(insertAt, 0, dragged);
  return next.map((item, index) => ({ ...item, displayOrder: index }));
}

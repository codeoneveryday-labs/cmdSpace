import type { WorkspaceRecord } from "./useWorkspaceController";

export function clearTabOwnership(
  workspaces: WorkspaceRecord[],
  tabId: number,
): WorkspaceRecord[] {
  return workspaces.map((workspace) => {
    if (workspace.tabId === tabId) return { ...workspace, tabId: null };
    if (workspace.canvasTabId === tabId) return { ...workspace, canvasTabId: null };
    return workspace;
  });
}

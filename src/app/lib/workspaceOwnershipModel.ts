import type { WorkspaceRecord } from "./useWorkspaceController";

export function clearTabOwnership(
  workspaces: WorkspaceRecord[],
  tabId: number,
): WorkspaceRecord[] {
  return workspaces.map((workspace) => {
    if (workspace.agentTabIds?.includes(tabId)) {
      const agentTabIds = workspace.agentTabIds.filter((id) => id !== tabId);
      return {
        ...workspace,
        agentTabIds,
        tabId: workspace.tabId === tabId ? agentTabIds[0] ?? null : workspace.tabId,
      };
    }
    if (workspace.tabId === tabId) return { ...workspace, tabId: null };
    if (workspace.canvasTabId === tabId) return { ...workspace, canvasTabId: null };
    return workspace;
  });
}

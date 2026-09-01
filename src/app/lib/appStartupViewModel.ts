import {
  getWorkspaceLoadingPresentation,
  shouldSuppressBootstrapShell,
  type WorkspaceLoadingPresentation,
} from "./startupGate";
import type { WorkspaceRecord } from "./useWorkspaceController";

export function getAppStartupView({
  activeTabId,
  activeWorkspaceId,
  workspacesHydrated,
  initialWorkspaceActivationHandled,
  pendingBootstrapClose,
  openingWorkspaceId,
  workspaces,
}: {
  activeTabId: number | null;
  activeWorkspaceId: string | null;
  workspacesHydrated: boolean;
  initialWorkspaceActivationHandled: boolean;
  pendingBootstrapClose: boolean;
  openingWorkspaceId: string | null;
  workspaces: readonly WorkspaceRecord[];
}): {
  hideBootstrapShell: boolean;
  workspaceLoadingPresentation: WorkspaceLoadingPresentation;
  showWorkspaceSwitchLoading: boolean;
  workspaceLoadingLabel: string;
} {
  const gateInput = {
    activeTabId,
    activeWorkspaceId,
    workspacesHydrated,
    initialWorkspaceActivationHandled,
    pendingBootstrapClose,
    openingWorkspaceId,
  };
  const workspaceLoadingPresentation = getWorkspaceLoadingPresentation(gateInput);
  const openingWorkspace = openingWorkspaceId === null
    ? null
    : workspaces.find((workspace) => workspace.id === openingWorkspaceId) ?? null;
  return {
    hideBootstrapShell: shouldSuppressBootstrapShell(gateInput),
    workspaceLoadingPresentation,
    showWorkspaceSwitchLoading: workspaceLoadingPresentation === "local",
    workspaceLoadingLabel: openingWorkspace
      ? `Opening ${openingWorkspace.name}…`
      : "Opening workspace…",
  };
}

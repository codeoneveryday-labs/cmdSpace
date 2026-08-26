export type StartupGateInput = {
  activeTabId: number | null;
  activeWorkspaceId: string | null;
  workspacesHydrated: boolean;
  initialWorkspaceActivationHandled: boolean;
  pendingBootstrapClose: boolean;
  openingWorkspaceId?: string | null;
};

export type WorkspaceLoadingPresentation = "blocking" | "local" | "idle";

export function shouldSuppressBootstrapShell(
  input: StartupGateInput,
): boolean {
  return (
    input.activeTabId === 1 &&
    input.activeWorkspaceId === null &&
    (!input.workspacesHydrated ||
      !input.initialWorkspaceActivationHandled ||
      input.pendingBootstrapClose)
  );
}

export function getWorkspaceLoadingPresentation(
  input: StartupGateInput,
): WorkspaceLoadingPresentation {
  if (shouldSuppressBootstrapShell(input)) {
    return "blocking";
  }

  return input.openingWorkspaceId ? "local" : "idle";
}

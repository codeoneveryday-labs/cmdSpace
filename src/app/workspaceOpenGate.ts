export type WorkspaceOpenGate = {
  isOpening: (workspaceId: string) => boolean;
  open: (
    workspaceId: string,
    openWorkspace: () => void | Promise<void>,
  ) => Promise<boolean>;
};

export function createWorkspaceOpenGate(): WorkspaceOpenGate {
  const openingWorkspaceIds = new Set<string>();

  return {
    isOpening: (workspaceId) => openingWorkspaceIds.has(workspaceId),
    open: async (workspaceId, openWorkspace) => {
      if (openingWorkspaceIds.has(workspaceId)) return false;

      openingWorkspaceIds.add(workspaceId);
      try {
        await openWorkspace();
        return true;
      } finally {
        openingWorkspaceIds.delete(workspaceId);
      }
    },
  };
}

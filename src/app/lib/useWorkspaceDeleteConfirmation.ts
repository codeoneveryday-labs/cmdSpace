import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { WorkspaceRecord } from "./useWorkspaceController";
import { WORKSPACE_DELETE_CONFIRM_STORAGE_KEY } from "../constants";

export function useWorkspaceDeleteConfirmation({
  workspacesRef,
  skipConfirmation,
  deleteWorkspace,
  pendingWorkspaceId,
  doNotAskAgain,
  setPendingWorkspaceId,
  setDoNotAskAgain,
  setSkipConfirmation,
}: {
  workspacesRef: MutableRefObject<readonly WorkspaceRecord[]>;
  skipConfirmation: boolean;
  deleteWorkspace: (workspaceId: string) => void;
  pendingWorkspaceId: string | null;
  doNotAskAgain: boolean;
  setPendingWorkspaceId: Dispatch<SetStateAction<string | null>>;
  setDoNotAskAgain: Dispatch<SetStateAction<boolean>>;
  setSkipConfirmation: Dispatch<SetStateAction<boolean>>;
}) {
  const handleCloseWorkspace = useCallback(
    (workspaceId: string) => {
      if (workspacesRef.current.length <= 1) return;
      if (skipConfirmation) {
        deleteWorkspace(workspaceId);
        return;
      }
      setDoNotAskAgain(false);
      setPendingWorkspaceId(workspaceId);
    },
    [deleteWorkspace, setDoNotAskAgain, setPendingWorkspaceId, skipConfirmation, workspacesRef],
  );

  const confirmDeleteWorkspace = useCallback(() => {
    if (pendingWorkspaceId === null) return;
    if (doNotAskAgain) {
      setSkipConfirmation(true);
      try {
        window.localStorage.setItem(WORKSPACE_DELETE_CONFIRM_STORAGE_KEY, "1");
      } catch {
        // Storage is optional.
      }
    }
    deleteWorkspace(pendingWorkspaceId);
    setPendingWorkspaceId(null);
  }, [deleteWorkspace, doNotAskAgain, pendingWorkspaceId, setPendingWorkspaceId, setSkipConfirmation]);

  const cancelDeleteWorkspace = useCallback(() => {
    setPendingWorkspaceId(null);
    setDoNotAskAgain(false);
  }, [setDoNotAskAgain, setPendingWorkspaceId]);

  return { handleCloseWorkspace, confirmDeleteWorkspace, cancelDeleteWorkspace };
}

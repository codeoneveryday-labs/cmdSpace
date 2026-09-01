import { useEffect, type Dispatch, type SetStateAction } from "react";

export function useWorkspaceSetupAutoOpen({
  hydrated,
  workspaceCount,
  setSetupOpen,
}: {
  hydrated: boolean;
  workspaceCount: number;
  setSetupOpen: Dispatch<SetStateAction<boolean>>;
}): void {
  useEffect(() => {
    if (hydrated && workspaceCount === 0) setSetupOpen(true);
  }, [hydrated, setSetupOpen, workspaceCount]);
}

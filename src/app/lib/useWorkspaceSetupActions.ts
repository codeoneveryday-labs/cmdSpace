import { useCallback, type MutableRefObject } from "react";
import type { Tab } from "@/modules/tabs";
import type { WorkspaceMode } from "@/modules/workspaces";
import type {
  CreateWorkspaceInput,
  WorkspaceRecord,
} from "./useWorkspaceController";
import { nextWorkspaceName } from "./workspaceCreationModel";

type CreateWorkspace = (
  input: CreateWorkspaceInput,
) => Promise<WorkspaceRecord | null>;

export function useWorkspaceSetupActions({
  createWorkspace,
  inheritedCwdForNewTab,
  tabsRef,
  newWorkspaceTab,
  newArchitectureTab,
  closeTab,
  setActiveId,
  onStandardWorkspaceReady,
  onCanvasWorkspaceReady,
  setWorkspaceSetupOpen,
  workspacesHydrated,
  workspacesLength,
}: {
  createWorkspace: CreateWorkspace;
  inheritedCwdForNewTab: () => string | undefined;
  tabsRef: MutableRefObject<readonly Tab[]>;
  newWorkspaceTab: CreateWorkspaceInput["newWorkspaceTab"];
  newArchitectureTab: CreateWorkspaceInput["newArchitectureTab"];
  closeTab: CreateWorkspaceInput["closeTab"];
  setActiveId: CreateWorkspaceInput["setActiveId"];
  onStandardWorkspaceReady?: CreateWorkspaceInput["onStandardWorkspaceReady"];
  onCanvasWorkspaceReady?: CreateWorkspaceInput["onCanvasWorkspaceReady"];
  setWorkspaceSetupOpen: (open: boolean) => void;
  workspacesHydrated: boolean;
  workspacesLength: number;
}) {
  const handleOpenWorkspaceWithoutAi = useCallback(
    async (
      terminalCount: number,
      workingFolder: string | null,
      initialCommands: string[] = [],
      requestedName?: string,
      requestedColor?: string,
      workspaceMode: WorkspaceMode = "standard",
    ) =>
      createWorkspace({
        terminalCount,
        workingFolder,
        initialCommands,
        requestedName,
        requestedColor,
        workspaceMode,
        inheritedCwd: inheritedCwdForNewTab(),
        nextWorkspaceName,
        tabs: [...tabsRef.current],
        newWorkspaceTab,
        newArchitectureTab,
        closeTab,
        setActiveId,
        onStandardWorkspaceReady,
        onCanvasWorkspaceReady,
        closeSetup: () => setWorkspaceSetupOpen(false),
        alert: (message) => window.alert(message),
      }),
    [
      closeTab,
      createWorkspace,
      inheritedCwdForNewTab,
      newArchitectureTab,
      newWorkspaceTab,
      onStandardWorkspaceReady,
      onCanvasWorkspaceReady,
      setActiveId,
      setWorkspaceSetupOpen,
      tabsRef,
    ],
  );

  const handleWorkspaceSetupCancel = useCallback(() => {
    if (workspacesHydrated && workspacesLength === 0) return;
    setWorkspaceSetupOpen(false);
  }, [setWorkspaceSetupOpen, workspacesHydrated, workspacesLength]);

  return { handleOpenWorkspaceWithoutAi, handleWorkspaceSetupCancel };
}

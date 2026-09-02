import { useCallback, type MutableRefObject } from "react";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
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
  newAgentChatTab,
  newWorkspaceTab,
  newArchitectureTab,
  closeTab,
  setActiveId,
  onStandardWorkspaceReady,
  onCanvasWorkspaceReady,
  setWorkspaceSetupOpen,
  workspacesHydrated,
  workspacesLength,
  setWorkspaceForkContext,
}: {
  createWorkspace: CreateWorkspace;
  inheritedCwdForNewTab: () => string | undefined;
  tabsRef: MutableRefObject<readonly Tab[]>;
  newAgentChatTab: CreateWorkspaceInput["newAgentChatTab"];
  newWorkspaceTab: CreateWorkspaceInput["newWorkspaceTab"];
  newArchitectureTab: CreateWorkspaceInput["newArchitectureTab"];
  closeTab: CreateWorkspaceInput["closeTab"];
  setActiveId: CreateWorkspaceInput["setActiveId"];
  onStandardWorkspaceReady?: CreateWorkspaceInput["onStandardWorkspaceReady"];
  onCanvasWorkspaceReady?: CreateWorkspaceInput["onCanvasWorkspaceReady"];
  setWorkspaceSetupOpen: (open: boolean) => void;
  workspacesHydrated: boolean;
  workspacesLength: number;
  setWorkspaceForkContext: (context: null) => void;
}) {
  const handleOpenWorkspaceWithoutAi = useCallback(
    async (
      terminalCount: number,
      workingFolder: string | null,
      initialCommands: string[] = [],
      requestedName?: string,
      requestedColor?: string,
      workspaceMode: WorkspaceMode = "standard",
      workspaceAgent: CliAgent | null = null,
      workspaceAgents: CliAgent[] = [],
      initialAgentDraft = "",
      initialHistoryAttachments: AgentChatHistoryAttachment[] = [],
    ) =>
      createWorkspace({
        terminalCount,
        workingFolder,
        initialCommands,
        requestedName,
        requestedColor,
        workspaceMode,
        workspaceAgent,
        workspaceAgents,
        initialAgentDraft,
        initialHistoryAttachments,
        inheritedCwd: inheritedCwdForNewTab(),
        nextWorkspaceName,
        tabs: [...tabsRef.current],
        newAgentChatTab,
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
      newAgentChatTab,
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
    setWorkspaceForkContext(null);
  }, [setWorkspaceForkContext, setWorkspaceSetupOpen, workspacesHydrated, workspacesLength]);

  return { handleOpenWorkspaceWithoutAi, handleWorkspaceSetupCancel };
}

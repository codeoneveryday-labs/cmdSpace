import { useCallback, type MutableRefObject } from "react";
import type { Tab } from "@/modules/tabs";
import type { CreateWorkspaceTerminalInput, WorkspaceRecord } from "./useWorkspaceController";

export function useWorkspaceTerminalCreationAction({
  workspaceId,
  tabsRef,
  canvasTerminalCreators,
  appendTerminalPane,
  newAgentChatTab,
  setActiveId,
  persistPaneRecord,
  persistedPaneFor,
  buildPaneRecord,
  saveRecentWorkspace,
  markWorkspacePaneLaunch,
  scheduleWorkspacePaneSessionSync,
  createWorkspaceTerminal,
}: {
  workspaceId: string | null;
  tabsRef: MutableRefObject<Tab[]>;
  canvasTerminalCreators: MutableRefObject<Map<number, (command?: string) => boolean>>;
  appendTerminalPane: CreateWorkspaceTerminalInput["appendTerminalPane"];
  newAgentChatTab: CreateWorkspaceTerminalInput["newAgentChatTab"];
  setActiveId: CreateWorkspaceTerminalInput["setActiveId"];
  persistPaneRecord: CreateWorkspaceTerminalInput["persistPaneRecord"];
  persistedPaneFor: CreateWorkspaceTerminalInput["persistedPaneFor"];
  buildPaneRecord: CreateWorkspaceTerminalInput["buildPaneRecord"];
  saveRecentWorkspace: (workspace: WorkspaceRecord) => void;
  markWorkspacePaneLaunch: CreateWorkspaceTerminalInput["markWorkspacePaneLaunch"];
  scheduleWorkspacePaneSessionSync: CreateWorkspaceTerminalInput["scheduleWorkspacePaneSessionSync"];
  createWorkspaceTerminal: (input: CreateWorkspaceTerminalInput) => boolean;
}) {
  return useCallback(
    (initialCommand = "") =>
      createWorkspaceTerminal({
        workspaceId,
        initialCommand,
        tabsRef,
        canvasTerminalCreators,
        appendTerminalPane,
        newAgentChatTab,
        setActiveId,
        persistPaneRecord,
        persistedPaneFor,
        buildPaneRecord,
        saveRecentWorkspace,
        markWorkspacePaneLaunch,
        scheduleWorkspacePaneSessionSync,
        alert: (message) => window.alert(message),
      }),
    [
      appendTerminalPane,
      buildPaneRecord,
      canvasTerminalCreators,
      createWorkspaceTerminal,
      markWorkspacePaneLaunch,
      newAgentChatTab,
      persistPaneRecord,
      persistedPaneFor,
      saveRecentWorkspace,
      scheduleWorkspacePaneSessionSync,
      setActiveId,
      tabsRef,
      workspaceId,
    ],
  );
}

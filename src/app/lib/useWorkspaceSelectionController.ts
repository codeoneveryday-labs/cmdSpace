import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArchitectureDiagram, Tab } from "@/modules/tabs";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { WorkspaceSelectionPane } from "./useWorkspaceSelection";
import {
  useWorkspaceSelection,
} from "./useWorkspaceSelection";
import { createWorkspaceOpenGate } from "../workspaceOpenGate";
import type { WorkspaceRecord } from "./useWorkspaceController";

type SelectionTab = Pick<Tab, "id" | "kind"> & { diagram?: ArchitectureDiagram };

export type WorkspaceSelectionControllerInput = {
  workspaces: WorkspaceRecord[];
  tabs: SelectionTab[];
  activeWorkspaceId: string | null;
  workspacesHydrated: boolean;
  setWorkspaces: React.Dispatch<React.SetStateAction<WorkspaceRecord[]>>;
  closeWorkspaceSetup: () => void;
  saveRecentWorkspace: (workspace: WorkspaceRecord) => void;
  activateTab: (tabId: number) => void;
  updateTab: (tabId: number, patch: { diagram: ArchitectureDiagram }) => void;
  persistCanvasDiagram: (tabId: number, diagram: ArchitectureDiagram) => void;
  createCanvasTab: (diagram: ArchitectureDiagram, title: string) => number;
  createAgentChatTab: (input: {
    title: string;
    provider: CliAgent;
    cwd: string;
    nativeSessionId: string | null;
    chatId?: string;
  }) => number;
  createWorkspaceTab: (
    workingFolder: string | undefined,
    count: number,
    panes?: WorkspaceSelectionPane[],
    paneLayout?: string | null,
    title?: string,
  ) => number;
  syncWorkspacePaneNativeSessions: (
    workspaceId: string,
    workspaceCwd: string | null,
  ) => Promise<WorkspaceSelectionPane[]>;
  buildCanvasWorkspaceDiagram: (
    terminalCount: number,
    workingFolder: string | null,
    initialCommands: string[],
  ) => ArchitectureDiagram;
};

export function useWorkspaceSelectionController(
  input: WorkspaceSelectionControllerInput,
) {
  const {
    workspaces,
    tabs,
    activeWorkspaceId,
    workspacesHydrated,
    setWorkspaces,
    closeWorkspaceSetup,
    saveRecentWorkspace,
    activateTab,
    updateTab,
    persistCanvasDiagram,
    createCanvasTab,
    createAgentChatTab,
    createWorkspaceTab,
    syncWorkspacePaneNativeSessions,
    buildCanvasWorkspaceDiagram,
  } = input;
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;
  const selectionRequestRef = useRef(0);
  const openGateRef = useRef(createWorkspaceOpenGate());
  const [openingWorkspaceId, setOpeningWorkspaceId] = useState<string | null>(null);
  const [initialActivationHandled, setInitialActivationHandled] = useState(false);
  const pendingBootstrapCloseRef = useRef(false);

  const selectWorkspace = useWorkspaceSelection({
    workspaces,
    tabs,
    closeWorkspaceSetup,
    saveRecentWorkspace,
    activateTab,
    updateCanvasTabDiagram: (tabId, diagram) => updateTab(tabId, { diagram }),
    persistCanvasDiagram,
    createCanvasTab,
    createAgentChatTab,
    createWorkspaceTab,
    replaceWorkspace: (workspaceId, patch) => {
      workspacesRef.current = workspacesRef.current.map((workspace) =>
        workspace.id === workspaceId ? { ...workspace, ...patch } : workspace,
      );
      setWorkspaces((current) =>
        current.map((workspace) =>
          workspace.id === workspaceId ? { ...workspace, ...patch } : workspace,
        ),
      );
    },
    listWorkspacePanes: (workspaceId) =>
      invoke<WorkspaceSelectionPane[]>("db_list_panes", { workspaceId }),
    resolvePaneResumeCommands: async (workspaceId, panes, workspaceCwd) => {
      if (!workspaceCwd) return panes;
      const resolved = await syncWorkspacePaneNativeSessions(workspaceId, workspaceCwd);
      return resolved.length > 0 ? resolved : panes;
    },
    buildCanvasWorkspaceDiagram,
    onLoadCanvasWorkspacePanesError: (error) =>
      console.error("Failed to load canvas workspace panes from SQLite:", error),
    onLoadWorkspacePanesError: (error) =>
      console.error("Failed to load workspace panes from SQLite:", error),
  });

  const selectWorkspaceById = useCallback(
    (workspaceId: string) => {
      const requestId = ++selectionRequestRef.current;
      window.localStorage.setItem("cmdspace.active-workspace", workspaceId);
      const workspace = workspacesRef.current.find((item) => item.id === workspaceId);
      const existingTabId = workspace?.tabId ?? workspace?.canvasTabId;
      if (existingTabId !== null && existingTabId !== undefined) {
        activateTab(existingTabId);
        return;
      }
      if (openGateRef.current.isOpening(workspaceId)) return;
      setOpeningWorkspaceId(workspaceId);
      void openGateRef.current
        .open(workspaceId, () =>
          selectWorkspace(workspaceId, () => requestId === selectionRequestRef.current),
        )
        .finally(() =>
          setOpeningWorkspaceId((current) =>
            current === workspaceId ? null : current,
          ),
        );
    },
    [activateTab, selectWorkspace],
  );

  const selectWorkspaceRef = useRef(selectWorkspaceById);
  selectWorkspaceRef.current = selectWorkspaceById;

  useEffect(() => {
    if (
      !workspacesHydrated ||
      workspaces.length === 0 ||
      activeWorkspaceId !== null ||
      initialActivationHandled ||
      pendingBootstrapCloseRef.current
    ) {
      return;
    }
    setInitialActivationHandled(true);
    const stored = window.localStorage.getItem("cmdspace.active-workspace");
    const workspace = workspaces.find((item) => item.id === stored) ?? workspaces[0];
    if (!workspace) return;
    pendingBootstrapCloseRef.current = true;
    selectWorkspaceById(workspace.id);
  }, [
    activeWorkspaceId,
    initialActivationHandled,
    selectWorkspaceById,
    workspaces,
    workspacesHydrated,
  ]);

  useEffect(() => {
    const unlisten = listen<string>("cmdspace:open-workspace", (event) => {
      selectWorkspaceRef.current(event.payload);
    });
    return () => {
      void unlisten.then((dispose) => dispose());
    };
  }, []);

  return {
    selectWorkspace,
    handleSelectWorkspace: selectWorkspaceById,
    openingWorkspaceId,
    initialActivationHandled,
    pendingBootstrapCloseRef,
  };
}

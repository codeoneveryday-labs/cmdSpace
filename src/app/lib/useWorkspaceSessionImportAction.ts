import { useCallback, type MutableRefObject } from "react";
import type { Tab } from "@/modules/tabs";
import type { ImportableAgentSession } from "@/modules/workspaces";
import type {
  ImportAgentSessionInput,
  WorkspaceRecord,
} from "./useWorkspaceController";

export function useWorkspaceSessionImportAction({
  workspaceId,
  tabsRef,
  appendTerminalPane,
  updateCanvasDiagram,
  setActiveId,
  persistPaneRecord,
  persistedPaneFor,
  buildPaneRecord,
  saveRecentWorkspace,
  scheduleWorkspacePaneSessionSync,
  importAgentSession,
}: {
  workspaceId: string | null;
  tabsRef: MutableRefObject<Tab[]>;
  appendTerminalPane: ImportAgentSessionInput["appendTerminalPane"];
  updateCanvasDiagram: ImportAgentSessionInput["updateCanvasDiagram"];
  setActiveId: ImportAgentSessionInput["setActiveId"];
  persistPaneRecord: ImportAgentSessionInput["persistPaneRecord"];
  persistedPaneFor: ImportAgentSessionInput["persistedPaneFor"];
  buildPaneRecord: ImportAgentSessionInput["buildPaneRecord"];
  saveRecentWorkspace: (workspace: WorkspaceRecord) => void;
  scheduleWorkspacePaneSessionSync: ImportAgentSessionInput["scheduleWorkspacePaneSessionSync"];
  importAgentSession: (input: ImportAgentSessionInput) => Promise<boolean>;
  alert?: (message: string) => void;
}) {
  return useCallback(
    (session: ImportableAgentSession): Promise<boolean> =>
      importAgentSession({
        session,
        workspaceId,
        tabsRef,
        appendTerminalPane,
        updateCanvasDiagram,
        setActiveId,
        persistPaneRecord,
        persistedPaneFor,
        buildPaneRecord,
        saveRecentWorkspace,
        scheduleWorkspacePaneSessionSync,
        alert: alert ?? ((message) => window.alert(message)),
      }),
    [
      alert,
      appendTerminalPane,
      buildPaneRecord,
      importAgentSession,
      persistedPaneFor,
      persistPaneRecord,
      saveRecentWorkspace,
      scheduleWorkspacePaneSessionSync,
      setActiveId,
      tabsRef,
      updateCanvasDiagram,
      workspaceId,
    ],
  );
}

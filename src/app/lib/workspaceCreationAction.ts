import { invoke } from "@tauri-apps/api/core";
import { normalizeWorkspaceAccentColor } from "@/modules/workspaces";
import { detectCliAgent } from "@/modules/terminal/lib/cliAgents";
import { serializeCanvasWorkspaceDiagram } from "@/modules/architecture";
import { resolveWorkspaceCreationPlan, workspaceAccentForIndex } from "./workspaceCreationModel";
import type { CreateWorkspaceInput, PersistedPaneRecord, WorkspaceRecord } from "./workspaceControllerTypes";

export type WorkspaceCreationActionDeps = {
  workspaces: WorkspaceRecord[];
  setWorkspaces: React.Dispatch<React.SetStateAction<WorkspaceRecord[]>>;
  persistPaneRecord: (pane: PersistedPaneRecord) => Promise<unknown>;
  saveRecentWorkspace: (workspace: WorkspaceRecord) => void;
};

export async function createWorkspaceAction(
  input: CreateWorkspaceInput,
  { workspaces, setWorkspaces, persistPaneRecord, saveRecentWorkspace }: WorkspaceCreationActionDeps,
): Promise<WorkspaceRecord | null> {
  const plan = resolveWorkspaceCreationPlan({
    terminalCount: input.terminalCount,
    workingFolder: input.workingFolder,
    inheritedCwd: input.inheritedCwd,
    initialCommands: input.initialCommands,
    requestedName: input.requestedName,
    workspaceMode: input.workspaceMode,
    workspaceAgent: input.workspaceAgent,
    workspaceAgents: input.workspaceAgents,
    workspaces,
    nextWorkspaceName: input.nextWorkspaceName,
  });
  if (plan.fallbackName === null) {
    input.alert("Workspace limit reached (99).");
    return null;
  }
  const {
    workspaceMode,
    effectiveWorkingFolder,
    paneLaunchPlan,
    canvasDiagram,
    agentProviders,
  } = plan;
  const name = plan.name ?? plan.fallbackName;
  if (!name) return null;
  const workspaceId = `workspace-tab-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 9)}`;
  const agentChatIds =
    workspaceMode === "agent"
      ? agentProviders.map((_, index) => `${workspaceId}:chat:${index + 1}`)
      : [];
  const agentTabIds =
    workspaceMode === "agent"
      ? agentProviders.map((provider, index) =>
          input.newAgentChatTab({
            title: `${name} · ${index + 1}`,
            provider,
            cwd: effectiveWorkingFolder ?? "",
            nativeSessionId: null,
            chatId: agentChatIds[index],
            initialDraft: index === 0 ? input.initialAgentDraft : undefined,
            initialHistoryAttachments:
              index === 0 ? input.initialHistoryAttachments : undefined,
          }),
        )
      : [];
  // A Standard workspace must not mount its terminals until the complete pane
  // plan is durable. Mounting first lets initial PTY callbacks race the
  // per-pane writes and can leave the workspace with only the first agent.
  const tabId =
    workspaceMode === "canvas"
      ? null
      : workspaceMode === "agent"
        ? agentTabIds[0] ?? null
        : null;
  const now = Date.now();
  const workspace: WorkspaceRecord = {
    id: workspaceId,
    name,
    count: workspaceMode === "agent" ? agentTabIds.length : input.terminalCount,
    accentColor: normalizeWorkspaceAccentColor(
      input.requestedColor,
      workspaceAccentForIndex(workspaces.length),
    ),
    workingFolder: effectiveWorkingFolder,
    createdAt: now,
    updatedAt: now,
    displayOrder: workspaces.length,
    paneLayout: canvasDiagram
      ? serializeCanvasWorkspaceDiagram(canvasDiagram)
      : null,
    tabId: workspaceMode === "canvas" ? null : tabId,
    canvasTabId: null,
    workspaceMode,
    agentProvider: workspaceMode === "agent" ? input.workspaceAgent ?? null : null,
    agentSessionId: null,
    agentTabIds,
    agentProviders,
    agentSessionIds:
      workspaceMode === "agent" ? agentProviders.map(() => null) : [],
    agentChatIds,
  };

  saveRecentWorkspace(workspace);
  if (paneLaunchPlan) {
    await Promise.all(
      paneLaunchPlan.map((pane) =>
        persistPaneRecord({
          workspaceId,
          paneIndex: pane.paneIndex,
          workingFolder: pane.workingFolder,
          lastCommand: pane.lastCommand,
          autoLaunch: pane.autoLaunch,
          agentProvider: pane.lastCommand
            ? detectCliAgent(pane.lastCommand)
            : null,
          nativeSessionId: null,
        }),
      ),
    );
  }
  try {
    await invoke("db_save_workspace", { workspace });
  } catch (error) {
    console.error("Failed to save workspace to SQLite:", error);
  }
  const openedWorkspace =
    workspaceMode === "standard"
      ? {
          ...workspace,
          tabId: input.newWorkspaceTab(
            effectiveWorkingFolder ?? undefined,
            input.terminalCount,
            paneLaunchPlan,
            null,
            name,
          ),
        }
      : workspaceMode === "canvas" && canvasDiagram
        ? {
            ...workspace,
            canvasTabId: input.newArchitectureTab(canvasDiagram, name),
          }
        : workspace;
  setWorkspaces((current) => [...current, openedWorkspace]);
  if (workspaceMode === "standard" && paneLaunchPlan) {
    input.onStandardWorkspaceReady?.(
      openedWorkspace.id,
      openedWorkspace.workingFolder,
      paneLaunchPlan,
    );
  }
  if (workspaceMode === "canvas" && paneLaunchPlan) {
    input.onCanvasWorkspaceReady?.(
      openedWorkspace.id,
      openedWorkspace.workingFolder,
      paneLaunchPlan,
    );
  }
  input.closeSetup();
  const activatedTabId = openedWorkspace.tabId ?? openedWorkspace.canvasTabId;
  if (activatedTabId !== null) input.setActiveId(activatedTabId);
  const bootstrapTab = input.tabs.find(
    (tab) => tab.id === 1 && tab.title === "shell",
  );
  if (bootstrapTab && input.tabs.length > 1) input.closeTab(bootstrapTab.id);
  return openedWorkspace;
}

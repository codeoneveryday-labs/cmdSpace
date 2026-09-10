export {
  DEFAULT_WORKSPACE_ACCENT_COLOR,
  normalizeWorkspaceAccentColor,
  WORKSPACE_ACCENT_COLORS,
  WorkspacesPanel,
  WorkspaceSetupView,
  type WorkspaceItem,
  type WorkspaceMode,
  type WorkspaceTerminalItem,
} from "./WorkspacesPanel";
export { ImportSessionDialog } from "./ImportSessionDialog";
export { buildSessionResumeCommand } from "./lib/importSessions";
export type {
  AgentSessionProvider,
  ImportableAgentSession,
} from "./lib/importSessions";
export {
  listWorkspaces,
  parseIpcError,
  saveWorkspace,
  toWorkspaceDto,
} from "./lib/workspaceIpc";
export type {
  IpcError,
  WorkspaceDto,
  WorkspaceDtoInput,
  WorkspaceModeValue,
  WorkspaceInvoke,
} from "./lib/workspaceIpc";

export { parseIpcError } from "@/lib/tauriError";
export type { IpcError } from "@/lib/tauriError";

/**
 * Stable workspace payload exchanged with the Rust DB commands.
 *
 * Keep transient tab ownership out of this shape so the persistence model and
 * the Tauri boundary cannot silently grow UI-only fields.
 */
export type WorkspaceDto = {
  id: string;
  name: string;
  count: number;
  accentColor: string | null;
  workingFolder: string | null;
  createdAt: number;
  updatedAt: number;
  displayOrder: number;
  paneLayout: string | null;
  workspaceMode: WorkspaceModeValue | null;
  pinned: boolean;
};

export type WorkspaceModeValue = "standard" | "canvas" | "agent";

export type WorkspaceDtoInput = {
  id: string;
  name: string;
  count: number;
  accentColor?: string | null;
  workingFolder?: string | null;
  createdAt: number;
  updatedAt: number;
  displayOrder: number;
  paneLayout?: string | null;
  workspaceMode?: WorkspaceModeValue | null;
  pinned?: boolean;
};

export type WorkspaceInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

export function toWorkspaceDto(workspace: WorkspaceDtoInput): WorkspaceDto {
  return {
    id: workspace.id,
    name: workspace.name,
    count: workspace.count,
    accentColor: workspace.accentColor ?? null,
    workingFolder: workspace.workingFolder ?? null,
    createdAt: workspace.createdAt,
    updatedAt: workspace.updatedAt,
    displayOrder: workspace.displayOrder,
    paneLayout: workspace.paneLayout ?? null,
    workspaceMode: normalizeWorkspaceMode(workspace.workspaceMode),
    pinned: workspace.pinned ?? false,
  };
}

export function listWorkspaces(invoke: WorkspaceInvoke): Promise<WorkspaceDto[]> {
  return invoke<WorkspaceDto[]>("db_list_workspaces").then((workspaces) =>
    workspaces.map((workspace) => ({
      ...workspace,
      workspaceMode: normalizeWorkspaceMode(workspace.workspaceMode),
    })),
  );
}

function normalizeWorkspaceMode(value: unknown): WorkspaceModeValue | null {
  return value === "standard" || value === "canvas" || value === "agent"
    ? value
    : null;
}

export function saveWorkspace(
  invoke: WorkspaceInvoke,
  workspace: WorkspaceDtoInput,
): Promise<void> {
  return invoke<void>("db_save_workspace", {
    workspace: toWorkspaceDto(workspace),
  });
}

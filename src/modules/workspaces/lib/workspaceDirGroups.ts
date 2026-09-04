import type { WorkspaceItem } from "../WorkspacesPanel";

export type WorkspaceDirGroup = {
  id: string;
  label: string;
  workspaces: WorkspaceItem[];
};

function groupKeyFor(workingFolder: string | null | undefined): {
  id: string;
  label: string;
} {
  const trimmed = (workingFolder ?? "").replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) return { id: "/", label: "/" };
  const label = parts[parts.length - 1] ?? trimmed;
  const parent = parts.slice(0, -1).join("/");
  const id = trimmed.startsWith("/")
    ? `/${parent}/${label}`
    : `${parent}/${label}`;
  return { id, label };
}

export function groupWorkspacesByDir(
  workspaces: WorkspaceItem[],
): WorkspaceDirGroup[] {
  const groups = new Map<string, WorkspaceDirGroup>();
  for (const workspace of workspaces) {
    const { id, label } = groupKeyFor(workspace.workingFolder);
    const existing = groups.get(id);
    if (existing) existing.workspaces.push(workspace);
    else groups.set(id, { id, label, workspaces: [workspace] });
  }
  return [...groups.values()];
}

export type WorkspaceGroupMoveStep = {
  draggedId: string;
  targetId: string;
  position: "before" | "after";
};

export function buildWorkspaceGroupMoveSteps(
  workspaces: WorkspaceItem[],
  draggedGroupId: string,
  targetGroupId: string,
  position: "before" | "after",
): WorkspaceGroupMoveStep[] {
  const groups = groupWorkspacesByDir(workspaces);
  const draggedIndex = groups.findIndex((group) => group.id === draggedGroupId);
  const targetIndex = groups.findIndex((group) => group.id === targetGroupId);
  const draggedGroup = groups[draggedIndex];
  const targetGroup = groups[targetIndex];
  if (!draggedGroup || !targetGroup || draggedIndex === targetIndex) return [];

  if (
    (position === "before" && draggedIndex < targetIndex) ||
    (position === "after" && draggedIndex > targetIndex)
  ) {
    return [];
  }

  if (position === "before") {
    const targetId = targetGroup.workspaces[0]?.id;
    if (!targetId) return [];
    return [...draggedGroup.workspaces].reverse().map((workspace) => ({
      draggedId: workspace.id,
      targetId,
      position,
    }));
  }

  const targetId = targetGroup.workspaces[targetGroup.workspaces.length - 1]?.id;
  if (!targetId) return [];
  return draggedGroup.workspaces.map((workspace, index) => ({
    draggedId: workspace.id,
    targetId: index === 0 ? targetId : draggedGroup.workspaces[index - 1]!.id,
    position,
  }));
}

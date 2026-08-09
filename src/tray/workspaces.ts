export type TrayWorkspace = {
  id: string;
  name: string;
  count: number;
  accentColor?: string | null;
  workingFolder?: string | null;
  updatedAt?: number;
  workspaceMode?: "standard" | "canvas" | null;
};

export function filterTrayWorkspaces(
  workspaces: TrayWorkspace[],
  query: string,
): TrayWorkspace[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return workspaces;

  return workspaces.filter((workspace) =>
    `${workspace.name}\n${workspace.workingFolder ?? ""}`
      .toLocaleLowerCase()
      .includes(needle),
  );
}

export function clampSelectionIndex(index: number, itemCount: number): number {
  if (itemCount === 0) return -1;
  return Math.max(0, Math.min(index, itemCount - 1));
}

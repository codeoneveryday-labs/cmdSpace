import type { CliAgent } from "@/modules/terminal/lib/cliAgents";

export type TrayWorkspace = {
  id: string;
  name: string;
  count: number;
  accentColor?: string | null;
  workingFolder?: string | null;
  updatedAt?: number;
  workspaceMode?: "standard" | "canvas" | "agent" | null;
  paneLayout?: string | null;
  agentProvider?: string | null;
  agentProviders?: Array<string | null> | null;
  terminals?: TrayTerminal[];
};

export type TrayTerminal = {
  label: string;
  agent?: CliAgent | null;
  paneIndex?: number;
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

export type TrayWorkspaceGroup = {
  id: string;
  label: string;
  workspaces: TrayWorkspace[];
};

function groupKeyFor(workingFolder: string): { id: string; label: string } {
  const trimmed = workingFolder.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]+/).filter(Boolean);
  if (parts.length === 0) return { id: "/", label: "/" };
  const label = parts[parts.length - 1] ?? trimmed;
  const parent = parts.slice(0, -1).join("/");
  const id = trimmed.startsWith("/") ? `/${parent}/${label}` : `${parent}/${label}`;
  return { id, label };
}

export function groupTrayWorkspacesByDir(
  workspaces: TrayWorkspace[],
): TrayWorkspaceGroup[] {
  const groups = new Map<string, TrayWorkspaceGroup>();
  for (const workspace of workspaces) {
    const folder = workspace.workingFolder ?? "";
    const { id, label } = groupKeyFor(folder);
    const existing = groups.get(id);
    if (existing) existing.workspaces.push(workspace);
    else groups.set(id, { id, label, workspaces: [workspace] });
  }
  return [...groups.values()].sort((left, right) =>
    left.label.localeCompare(right.label),
  );
}

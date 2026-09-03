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

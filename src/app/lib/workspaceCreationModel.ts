import type { ArchitectureDiagram } from "@/modules/tabs";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import {
  DEFAULT_WORKSPACE_ACCENT_COLOR,
  WORKSPACE_ACCENT_COLORS,
} from "@/modules/workspaces";
import type { WorkspaceRecord } from "./useWorkspaceController";
import { WORKSPACE_LIMIT } from "../constants";
import type { WorkspaceMode } from "@/modules/workspaces";

export function resolveWorkspaceCreationPlan({
  terminalCount,
  workingFolder,
  inheritedCwd,
  initialCommands = [],
  requestedName,
  workspaceMode = "standard",
  workspaceAgent,
  workspaceAgents,
  workspaces,
  nextWorkspaceName: resolveNextWorkspaceName = nextWorkspaceName,
}: {
  terminalCount: number;
  workingFolder: string | null;
  inheritedCwd: string | undefined;
  initialCommands?: string[];
  requestedName?: string;
  workspaceMode?: WorkspaceMode;
  workspaceAgent?: CliAgent | null;
  workspaceAgents?: CliAgent[];
  workspaces: WorkspaceRecord[];
  nextWorkspaceName?: (workspaces: WorkspaceRecord[]) => string | null;
}) {
  const fallbackName = resolveNextWorkspaceName(workspaces);
  const name = requestedName?.trim() || fallbackName;
  const effectiveWorkingFolder = workingFolder ?? inheritedCwd ?? null;
  const paneLaunchPlan =
    initialCommands.length > 0 || workspaceMode === "canvas"
      ? Array.from({ length: terminalCount }, (_, paneIndex) => ({
          paneIndex,
          workingFolder: effectiveWorkingFolder,
          lastCommand: initialCommands[paneIndex] ?? null,
          autoLaunch: Boolean(initialCommands[paneIndex]),
        }))
      : undefined;
  const agentProviders =
    workspaceMode === "agent"
      ? (workspaceAgents?.length
          ? workspaceAgents
          : workspaceAgent
            ? [workspaceAgent]
            : []
        ).slice(0, 12)
      : [];

  return {
    fallbackName,
    name,
    workspaceMode,
    initialCommands,
    effectiveWorkingFolder,
    paneLaunchPlan,
    agentProviders,
    canvasDiagram:
      workspaceMode === "canvas"
        ? buildCanvasWorkspaceDiagram(
            terminalCount,
            effectiveWorkingFolder,
            initialCommands,
          )
        : null,
  };
}

export function buildCanvasWorkspaceDiagram(
  terminalCount: number,
  workingFolder: string | null,
  initialCommands: string[],
): ArchitectureDiagram {
  const columns = terminalCount === 1 ? 1 : 2;
  const terminalWidth = 620;
  const terminalHeight = 400;
  const gap = 48;

  return {
    nodes: Array.from({ length: terminalCount }, (_, index) => ({
      id: `workspace-terminal-${index + 1}`,
      kind: "terminal" as const,
      label: `Terminal ${index + 1}`,
      technology: "",
      x: 96 + (index % columns) * (terminalWidth + gap),
      y: 96 + Math.floor(index / columns) * (terminalHeight + gap),
      width: terminalWidth,
      height: terminalHeight,
      ...(workingFolder ? { cwd: workingFolder } : {}),
      ...(initialCommands[index]
        ? { initialCommand: initialCommands[index] }
        : {}),
      terminalChromeVersion: 2 as const,
    })),
    edges: [],
  };
}

export function nextWorkspaceName(workspaces: WorkspaceRecord[]): string | null {
  const used = new Set(
    workspaces.flatMap((workspace) => [workspace.id, workspace.name]),
  );
  for (let index = 1; index <= WORKSPACE_LIMIT; index += 1) {
    const name = `workspace-${String(index).padStart(2, "0")}`;
    if (!used.has(name)) return name;
  }
  return null;
}

export function workspaceAccentForIndex(index: number): string {
  return (
    WORKSPACE_ACCENT_COLORS[index % WORKSPACE_ACCENT_COLORS.length] ??
    DEFAULT_WORKSPACE_ACCENT_COLOR
  );
}

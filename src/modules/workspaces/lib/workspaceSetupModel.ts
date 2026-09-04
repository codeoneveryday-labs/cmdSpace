import {
  CLI_AGENT_DEFINITIONS,
  normalizeCliAgentLaunchCommand,
  type CliAgentDefinition,
} from "@/modules/terminal/lib/cliAgents";
import { isolatedAgentCommand } from "@/modules/ai/lib/agentWorktree";
import {
  buildSessionResumeCommand,
  type ImportableAgentSession,
} from "./importSessions";

export const TERMINAL_COUNTS = [1, 2, 4, 6, 8, 10, 12] as const;
export const WORKSPACE_SETUP_PRESETS: Array<{
  name: string;
  description: string;
  count: (typeof TERMINAL_COUNTS)[number];
}> = [
  { name: "Focus", description: "Single terminal", count: 1 },
  { name: "Pair", description: "Side by side", count: 2 },
  { name: "Quad", description: "2 x 2 grid", count: 4 },
  { name: "Builder", description: "2 x 3 grid", count: 6 },
  { name: "Review", description: "2 x 4 grid", count: 8 },
  { name: "Lab", description: "3 x 4 grid", count: 12 },
];
export const AGENT_CLI_OPTIONS = CLI_AGENT_DEFINITIONS;

export function resolveFolderCommand(
  command: string,
  currentFolder: string,
): string | null {
  const match = /^cd(?:\s+(.+))?$/i.exec(command.trim());
  if (!match) return null;
  const target = stripPathQuotes((match[1] ?? "~").trim()) || "~";
  return resolveWorkspacePath(target, currentFolder.trim());
}

export function recentWorkspaceFolderLabel(path: string): string {
  const normalized = normalizeWorkspacePath(path);
  const home = inferHomePath(normalized);
  if (home && (normalized === home || normalized.startsWith(`${home}/`))) {
    return `~${normalized.slice(home.length)}`;
  }
  return normalized;
}

export function coerceTerminalCount(
  count: number,
): (typeof TERMINAL_COUNTS)[number] {
  return TERMINAL_COUNTS.includes(count as (typeof TERMINAL_COUNTS)[number])
    ? (count as (typeof TERMINAL_COUNTS)[number])
    : 1;
}

export function buildAgentCliCommand(command: string, launch?: string): string {
  const trimmed = command.trim();
  if (!trimmed) return "";
  return launch?.trim() || trimmed;
}

export function agentCommandPlan(
  agentCounts: Record<string, number>,
  customCommand: string,
  effectiveCommands: Record<string, string> = {},
): string[] {
  const commands: string[] = [];
  for (const agent of AGENT_CLI_OPTIONS) {
    const count = agentCounts[agent.id] ?? 0;
    const command = normalizeCliAgentLaunchCommand(
      agent.id,
      effectiveCommands[agent.id] || agent.launch || agent.command,
    );
    for (let index = 0; index < count; index += 1) commands.push(command);
  }
  const customCount = agentCounts.custom ?? 0;
  const custom = buildAgentCliCommand(customCommand);
  if (custom) {
    for (let index = 0; index < customCount; index += 1) commands.push(custom);
  }
  return commands;
}

export function resolveEffectiveAgentCommands(
  agents: CliAgentDefinition[],
  drafts: Record<string, string>,
  stored: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    agents.map((agent) => [
      agent.id,
      normalizeCliAgentLaunchCommand(
        agent.id,
        drafts[agent.id]?.trim() ||
          stored[agent.id]?.trim() ||
          agent.launch ||
          agent.command,
      ),
    ]),
  );
}

export function buildWorkspaceLaunchCommands({
  agentCounts,
  customCommand,
  effectiveCommands,
  selectedImportSessions,
  cliTerminalCapacity,
  isolateAgentWorktrees,
  agentWorktreeGroup,
}: {
  agentCounts: Record<string, number>;
  customCommand: string;
  effectiveCommands: Record<string, string>;
  selectedImportSessions: ImportableAgentSession[];
  cliTerminalCapacity: number;
  isolateAgentWorktrees: boolean;
  agentWorktreeGroup: string;
}): string[] {
  const plannedCliCommands = agentCommandPlan(
    agentCounts,
    customCommand,
    effectiveCommands,
  ).slice(0, cliTerminalCapacity);
  const plannedCommands = [
    ...selectedImportSessions.map((session) =>
      buildSessionResumeCommand(session.provider, session.sessionId),
    ),
    ...plannedCliCommands,
  ];
  return plannedCommands.map((command, index) =>
    isolateAgentWorktrees
      ? isolatedAgentCommand(command, `agent-${index + 1}`, agentWorktreeGroup)
      : command,
  );
}

function stripPathQuotes(value: string): string {
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' || first === "'") && first === last) return value.slice(1, -1);
  return value;
}

function resolveWorkspacePath(target: string, currentFolder: string): string {
  const home = inferHomePath(currentFolder);
  const expandedTarget =
    target === "~" || target.startsWith("~/") || target.startsWith("~\\")
      ? `${home ?? ""}${target.slice(1)}`
      : target;
  const joinedTarget =
    isAbsoluteWorkspacePath(expandedTarget) || !currentFolder
      ? expandedTarget
      : `${currentFolder.replace(/[\\/]+$/, "")}/${expandedTarget}`;
  return normalizeWorkspacePath(joinedTarget);
}

function inferHomePath(currentFolder: string): string | null {
  const normalized = currentFolder.replace(/\\/g, "/");
  const unixMatch = /^\/(Users|home)\/[^/]+/i.exec(normalized);
  if (unixMatch) return unixMatch[0];
  const windowsMatch = /^[A-Za-z]:\/Users\/[^/]+/i.exec(normalized);
  return windowsMatch?.[0] ?? null;
}

function isAbsoluteWorkspacePath(path: string): boolean {
  return (
    path.startsWith("/") ||
    path.startsWith("\\\\") ||
    /^[A-Za-z]:[\\/]/.test(path)
  );
}

function normalizeWorkspacePath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const drive = /^[A-Za-z]:/.exec(normalized)?.[0] ?? "";
  const absolute = normalized.startsWith("/") || Boolean(drive);
  const rest = drive ? normalized.slice(drive.length) : normalized;
  const parts: string[] = [];
  for (const part of rest.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length > 0) parts.pop();
      continue;
    }
    parts.push(part);
  }
  const joined = parts.join("/");
  if (drive) return joined ? `${drive}/${joined}` : `${drive}/`;
  if (absolute) return joined ? `/${joined}` : "/";
  return joined || ".";
}

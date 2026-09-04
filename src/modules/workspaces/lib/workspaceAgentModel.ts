import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { WorkspaceTerminalItem } from "../WorkspacesPanel";

export function getWorkspaceCliAgent(
  terminals: readonly Pick<WorkspaceTerminalItem, "agent">[] | undefined,
): CliAgent | null {
  const firstAgent = terminals?.[0]?.agent;
  if (!firstAgent) return null;
  return terminals.every((terminal) => terminal.agent === firstAgent)
    ? firstAgent
    : null;
}

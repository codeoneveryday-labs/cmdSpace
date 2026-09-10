import type { CliAgent } from "@/modules/terminal/lib/cliAgents";

type AgentTerminal = { agent?: CliAgent | null };

export function getWorkspaceCliAgent(
  terminals: readonly AgentTerminal[] | undefined,
): CliAgent | null {
  const firstAgent = terminals?.[0]?.agent;
  if (!firstAgent) return null;
  return terminals.every((terminal) => terminal.agent === firstAgent)
    ? firstAgent
    : null;
}

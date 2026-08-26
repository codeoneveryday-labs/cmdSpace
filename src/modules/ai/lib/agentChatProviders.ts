import {
  getEnabledCliAgentDefinitions,
  type CliAgent,
  type CliAgentDefinition,
} from "@/modules/terminal/lib/cliAgents";

export type AgentChatProvider = CliAgentDefinition & {
  chatTransport: NonNullable<CliAgentDefinition["chatTransport"]>;
};

/**
 * Agent Chat setup follows the user's configured CLI list.  It deliberately
 * does not require a structured transport marker here: setup is also the
 * place where print/RPC adapters are selected, and filtering on the marker
 * would make configured providers disappear from the picker.
 */
export function resolveAgentChatWorkspaceAgents(input: {
  configuredIds: readonly string[];
  disabledIds: readonly string[];
}): CliAgentDefinition[] {
  return getEnabledCliAgentDefinitions(input.configuredIds, input.disabledIds).filter(
    (agent) => agent.id !== "herdr",
  );
}

export function resolveAgentChatProviders(input: {
  configuredIds: readonly string[];
  disabledIds: readonly string[];
  installedIds: readonly CliAgent[];
}): AgentChatProvider[] {
  const installed = new Set(input.installedIds);
  return getEnabledCliAgentDefinitions(input.configuredIds, input.disabledIds).filter(
    (agent): agent is AgentChatProvider =>
      installed.has(agent.id) && agent.chatTransport !== undefined,
  );
}

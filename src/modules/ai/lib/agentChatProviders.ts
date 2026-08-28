import {
  getEnabledCliAgentDefinitions,
  type CliAgent,
  type CliAgentDefinition,
} from "@/modules/terminal/lib/cliAgents";

export type AgentChatProvider = CliAgentDefinition & {
  chatTransport: NonNullable<CliAgentDefinition["chatTransport"]>;
};

/**
 * Providers whose Agent Chat transport has verified lifecycle, resume, history,
 * and error-reporting support. Add a provider here only after its end-to-end
 * contract is covered by provider-specific tests.
 */
export const FULLY_SUPPORTED_AGENT_CHAT_PROVIDER_IDS = ["codex", "cmd", "claude"] as const satisfies readonly CliAgent[];

const fullySupportedProviderIds = new Set<CliAgent>(
  FULLY_SUPPORTED_AGENT_CHAT_PROVIDER_IDS,
);

function isFullySupportedAgentChatProvider(agent: CliAgentDefinition): boolean {
  return fullySupportedProviderIds.has(agent.id);
}

/**
 * Agent Chat setup applies two gates: the user must enable the CLI in Settings,
 * and the provider must have a fully supported Agent Chat contract.
 */
export function resolveAgentChatWorkspaceAgents(input: {
  configuredIds: readonly string[];
  disabledIds: readonly string[];
}): CliAgentDefinition[] {
  return getEnabledCliAgentDefinitions(input.configuredIds, input.disabledIds).filter(
    isFullySupportedAgentChatProvider,
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
      installed.has(agent.id) &&
      isFullySupportedAgentChatProvider(agent) &&
      agent.chatTransport !== undefined,
  );
}

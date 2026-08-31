import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CliAgent, CliAgentDefinition } from "@/modules/terminal/lib/cliAgents";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";

export function useWorkspaceSetupAgentSelectionSync({
  forkContext,
  agentChatAgents,
  configuredAgentCliOptions,
  agentCounts,
  workspaceMode,
  setWorkspaceMode,
  setSelectedChatAgent,
  setSetupStep,
  setAgentCounts,
}: {
  forkContext?: { provider: CliAgent; attachment: AgentChatHistoryAttachment } | null;
  agentChatAgents: CliAgentDefinition[];
  configuredAgentCliOptions: CliAgentDefinition[];
  agentCounts: Record<string, number>;
  workspaceMode: "standard" | "canvas" | "agent";
  setWorkspaceMode: Dispatch<SetStateAction<"standard" | "canvas" | "agent">>;
  setSelectedChatAgent: Dispatch<SetStateAction<CliAgent | null>>;
  setSetupStep: Dispatch<SetStateAction<"layout" | "agents">>;
  setAgentCounts: Dispatch<SetStateAction<Record<string, number>>>;
}) {
  useEffect(() => {
    if (!forkContext) return;
    setWorkspaceMode("agent");
    setSelectedChatAgent(forkContext.provider);
    setSetupStep("agents");
    setAgentCounts({ [forkContext.provider]: 1 });
  }, [forkContext, setAgentCounts, setSelectedChatAgent, setSetupStep, setWorkspaceMode]);

  useEffect(() => {
    const selected =
      (workspaceMode === "agent"
        ? agentChatAgents
        : configuredAgentCliOptions
      ).find((agent) => (agentCounts[agent.id] ?? 0) > 0);
    setSelectedChatAgent(selected?.id ?? agentChatAgents[0]?.id ?? null);
  }, [
    agentChatAgents,
    agentCounts,
    configuredAgentCliOptions,
    setSelectedChatAgent,
    workspaceMode,
  ]);
}

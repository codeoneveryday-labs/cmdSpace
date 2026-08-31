import { useCallback, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import { regularTerminalCount } from "./importSessions";
import {
  calculateAssignedCliTerminals,
  calculateCliTerminalCapacity,
  calculateRemainingAgentSlots,
  clampAgentCount,
  pruneAgentCountsToCapacity,
} from "./workspaceAgentAssignmentModel";

export function useWorkspaceSetupAgentCapacity({
  terminalCount,
  selectedImportSessionCount,
  agentCounts,
  workspaceMode,
  configuredAgentIds,
  disabledAgentIds,
  setAgentCounts,
  setSelectedChatAgent,
}: {
  terminalCount: number;
  selectedImportSessionCount: number;
  agentCounts: Record<string, number>;
  workspaceMode: "standard" | "canvas" | "agent";
  configuredAgentIds: string[];
  disabledAgentIds: string[];
  setAgentCounts: Dispatch<SetStateAction<Record<string, number>>>;
  setSelectedChatAgent: Dispatch<SetStateAction<CliAgent | null>>;
}) {
  const assignedCliTerminals = calculateAssignedCliTerminals(agentCounts);
  const assignedAgentTerminals =
    selectedImportSessionCount + assignedCliTerminals;
  const regularTerminals = regularTerminalCount(
    terminalCount,
    selectedImportSessionCount,
    assignedCliTerminals,
  );
  const remainingAgentSlots = calculateRemainingAgentSlots(
    terminalCount,
    selectedImportSessionCount,
    assignedCliTerminals,
  );
  const cliTerminalCapacity = calculateCliTerminalCapacity(
    terminalCount,
    selectedImportSessionCount,
  );

  const setAgentCount = useCallback(
    (id: string, nextCount: number) => {
      setAgentCounts((current) => {
        const clamped = clampAgentCount(
          id,
          nextCount,
          current,
          cliTerminalCapacity,
        );
        const next = { ...current, [id]: clamped };
        if (clamped === 0) delete next[id];
        if (workspaceMode === "agent" && clamped > 0) {
          setSelectedChatAgent(id as CliAgent);
        }
        return next;
      });
    },
    [cliTerminalCapacity, setAgentCounts, setSelectedChatAgent, workspaceMode],
  );

  useEffect(() => {
    setAgentCounts((current) => {
      const ids = [...configuredAgentIds, "custom"];
      return pruneAgentCountsToCapacity(current, cliTerminalCapacity, ids);
    });
  }, [cliTerminalCapacity, configuredAgentIds, disabledAgentIds, setAgentCounts]);

  return {
    assignedCliTerminals,
    assignedAgentTerminals,
    regularTerminals,
    remainingAgentSlots,
    cliTerminalCapacity,
    setAgentCount,
  };
}

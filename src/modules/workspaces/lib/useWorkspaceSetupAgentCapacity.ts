import { useCallback, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
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
  configuredAgentIds,
  disabledAgentIds,
  setAgentCounts,
}: {
  terminalCount: number;
  selectedImportSessionCount: number;
  agentCounts: Record<string, number>;
  configuredAgentIds: string[];
  disabledAgentIds: string[];
  setAgentCounts: Dispatch<SetStateAction<Record<string, number>>>;
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
        return next;
      });
    },
    [cliTerminalCapacity, setAgentCounts],
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

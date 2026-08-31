import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { ImportableAgentSession } from "./importSessions";

export function useWorkspaceSetupImportSelection({
  remainingAgentSlots,
  selectedImportSessions,
  setSelectedImportSessions,
}: {
  remainingAgentSlots: number;
  selectedImportSessions: ImportableAgentSession[];
  setSelectedImportSessions: Dispatch<SetStateAction<ImportableAgentSession[]>>;
}) {
  return useCallback(
    async (sessions: ImportableAgentSession[]): Promise<boolean> => {
      if (sessions.length === 0 || sessions.some((session) => session.active)) {
        return false;
      }
      if (sessions.length > remainingAgentSlots) {
        window.alert(
          `Only ${remainingAgentSlots} terminal slots are available for imported sessions.`,
        );
        return false;
      }
      const existingKeys = new Set(
        selectedImportSessions.map(
          (session) => `${session.provider}:${session.sessionId}`,
        ),
      );
      const incomingKeys = sessions.map(
        (session) => `${session.provider}:${session.sessionId}`,
      );
      if (
        new Set(incomingKeys).size !== incomingKeys.length ||
        incomingKeys.some((key) => existingKeys.has(key))
      ) {
        window.alert("One or more agent sessions are already selected.");
        return false;
      }
      setSelectedImportSessions((current) => [...current, ...sessions]);
      return true;
    },
    [
      remainingAgentSlots,
      selectedImportSessions,
      setSelectedImportSessions,
    ],
  );
}

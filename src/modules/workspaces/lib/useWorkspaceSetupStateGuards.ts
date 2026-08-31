import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { ImportableAgentSession } from "./importSessions";

export function useWorkspaceSetupStateGuards({
  terminalCount,
  customCommand,
  setSelectedImportSessions,
  setAgentCounts,
}: {
  terminalCount: number;
  customCommand: string;
  setSelectedImportSessions: Dispatch<SetStateAction<ImportableAgentSession[]>>;
  setAgentCounts: Dispatch<SetStateAction<Record<string, number>>>;
}): void {
  useEffect(() => {
    setSelectedImportSessions((current) =>
      current.length > terminalCount ? current.slice(0, terminalCount) : current,
    );
  }, [setSelectedImportSessions, terminalCount]);

  useEffect(() => {
    if (customCommand.trim()) return;
    setAgentCounts((current) => {
      if (!current.custom) return current;
      const next = { ...current };
      delete next.custom;
      return next;
    });
  }, [customCommand, setAgentCounts]);
}

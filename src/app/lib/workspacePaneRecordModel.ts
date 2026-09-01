import {
  buildSessionResumeCommand,
  isResumeCommand,
} from "@/modules/workspaces/lib/importSessions";
import { detectCliAgent } from "@/modules/terminal/lib/cliAgents";
import type { PersistedPaneRecord } from "./useWorkspaceController";
import type { WorkspaceSelectionPane } from "./useWorkspaceSelection";

export function buildWorkspacePaneRecord(
  workspaceId: string,
  paneIndex: number,
  workingFolder: string | null,
  lastCommand: string | null,
  autoLaunch: boolean,
  existingPane?: WorkspaceSelectionPane,
  explicitNativeSessionId?: string | null,
  preserveExistingNativeSession = true,
): PersistedPaneRecord {
  if (!autoLaunch || !lastCommand) {
    return {
      workspaceId,
      paneIndex,
      workingFolder,
      lastCommand: null,
      autoLaunch: false,
      agentProvider: null,
      nativeSessionId: null,
    };
  }

  const provider = detectCliAgent(lastCommand);
  if (!provider) {
    return {
      workspaceId,
      paneIndex,
      workingFolder,
      lastCommand,
      autoLaunch,
      agentProvider: existingPane?.agentProvider ?? null,
      nativeSessionId: existingPane?.nativeSessionId ?? null,
    };
  }

  if (explicitNativeSessionId) {
    return {
      workspaceId,
      paneIndex,
      workingFolder,
      lastCommand: buildSessionResumeCommand(provider, explicitNativeSessionId),
      autoLaunch: true,
      agentProvider: provider,
      nativeSessionId: explicitNativeSessionId,
    };
  }

  if (
    preserveExistingNativeSession &&
    existingPane?.nativeSessionId &&
    existingPane.agentProvider === provider &&
    !isResumeCommand(lastCommand)
  ) {
    return {
      workspaceId,
      paneIndex,
      workingFolder,
      lastCommand:
        existingPane.lastCommand ??
        buildSessionResumeCommand(provider, existingPane.nativeSessionId),
      autoLaunch: true,
      agentProvider: provider,
      nativeSessionId: existingPane.nativeSessionId,
    };
  }

  return {
    workspaceId,
    paneIndex,
    workingFolder,
    lastCommand,
    autoLaunch: true,
    agentProvider: provider,
    nativeSessionId: isResumeCommand(lastCommand)
      ? (existingPane?.nativeSessionId ?? null)
      : null,
  };
}

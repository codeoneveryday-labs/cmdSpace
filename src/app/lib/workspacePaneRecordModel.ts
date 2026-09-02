import {
  buildSessionResumeCommand,
  isResumeCommand,
} from "@/modules/workspaces/lib/importSessions";
import { detectCliAgent } from "@/modules/terminal/lib/cliAgents";
import type { PersistedPaneRecord } from "./useWorkspaceController";
import type { WorkspaceSelectionPane } from "./useWorkspaceSelection";

export type ExistingPanePolicy = "preserve" | "clear";

function preserveExistingNativeSession(policy: ExistingPanePolicy): boolean {
  return policy === "preserve";
}

export function buildWorkspacePaneRecord(
  workspaceId: string,
  paneIndex: number,
  workingFolder: string | null,
  lastCommand: string | null,
  autoLaunch: boolean,
  existingPane?: WorkspaceSelectionPane,
  explicitNativeSessionId?: string | null,
  existingPanePolicy: ExistingPanePolicy = "preserve",
): PersistedPaneRecord {
  if (!autoLaunch || !lastCommand) {
    if (preserveExistingNativeSession(existingPanePolicy) && existingPane?.autoLaunch && existingPane.lastCommand) {
      return {
        workspaceId,
        paneIndex,
        workingFolder,
        lastCommand: existingPane.lastCommand,
        autoLaunch: true,
        agentProvider: existingPane.agentProvider ?? null,
        nativeSessionId: existingPane.nativeSessionId ?? null,
      };
    }
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
    preserveExistingNativeSession(existingPanePolicy) &&
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

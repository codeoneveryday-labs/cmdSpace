import { useCallback } from "react";
import type { TerminalPaneHandle } from "@/modules/terminal";
import {
  findLeafAutoLaunch,
  findLeafCwd,
  findLeafLastCommand,
  hasLeaf,
  leafIds,
} from "@/modules/terminal";
import type { TerminalTab, Tab } from "@/modules/tabs";
import type { PersistedPaneRecord, WorkspaceRecord } from "./useWorkspaceController";
import type { ExistingPanePolicy } from "./workspacePaneRecordModel";
import type { WorkspaceSelectionPane } from "./useWorkspaceSelection";

type PaneRecordBuilder = (
  workspaceId: string,
  paneIndex: number,
  workingFolder: string | null,
  lastCommand: string | null,
  autoLaunch: boolean,
  existingPane?: WorkspaceSelectionPane,
  explicitNativeSessionId?: string | null,
  existingPanePolicy?: ExistingPanePolicy,
) => PersistedPaneRecord;

export type TerminalWorkspaceActionPorts = {
  activeLeafId: number | null;
  activeWorkspaceId: string | null;
  tabsRef: { current: Tab[] };
  workspacesRef: { current: WorkspaceRecord[] };
  terminalRefs: { current: Map<number, TerminalPaneHandle> };
  pendingVoiceDraftsRef: { current: Map<number, string> };
  workspacePaneLaunchAtRef: { current: Map<string, number> };
  setLeafCwd: (leafId: number, cwd: string) => void;
  setLeafLaunchCommand: (leafId: number, command: string | null) => void;
  persistPaneRecord: (pane: PersistedPaneRecord) => Promise<unknown>;
  persistedPaneFor: (
    workspaceId: string,
    paneIndex: number,
  ) => WorkspaceSelectionPane | undefined;
  buildPaneRecord: PaneRecordBuilder;
  scheduleWorkspacePaneSessionSync: (
    workspaceId: string,
    cwd: string | null,
  ) => void;
  respawnSession: (
    leafId: number,
    cwd?: string,
    relaunchInitialCommand?: boolean,
  ) => Promise<void>;
  replaceSessionCommand: (
    leafId: number,
    cwd: string | undefined,
    command: string | null,
  ) => Promise<void>;
};

export function useTerminalWorkspaceActions(ports: TerminalWorkspaceActionPorts) {
  const handleTerminalCwd = useCallback(
    (leafId: number, cwd: string) => {
      ports.setLeafCwd(leafId, cwd);
      const tab = ports.tabsRef.current.find(
        (item): item is TerminalTab =>
          item.kind === "terminal" && hasLeaf(item.paneTree, leafId),
      );
      if (!tab) return;
      const workspace =
        ports.workspacesRef.current.find((item) => item.tabId === tab.id) ??
        ports.workspacesRef.current.find((item) => item.id === ports.activeWorkspaceId);
      if (!workspace) return;
      const paneIndex = leafIds(tab.paneTree).indexOf(leafId);
      if (paneIndex === -1) return;
      const lastCommand = findLeafLastCommand(tab.paneTree, leafId) ?? null;
      const autoLaunch = findLeafAutoLaunch(tab.paneTree, leafId);
      void ports
        .persistPaneRecord(
          ports.buildPaneRecord(
            workspace.id,
            paneIndex,
            cwd,
            autoLaunch ? lastCommand : null,
            autoLaunch,
            ports.persistedPaneFor(workspace.id, paneIndex),
          ),
        )
        .catch((error) => console.error("Failed to save terminal pane cwd to DB:", error));
    },
    [ports],
  );

  const changeTerminalDirectory = useCallback(
    (path: string) => {
      const nextPath = path.trim();
      if (ports.activeLeafId === null || !nextPath) return;
      handleTerminalCwd(ports.activeLeafId, nextPath);
      void ports.respawnSession(ports.activeLeafId, nextPath, true);
      ports.terminalRefs.current.get(ports.activeLeafId)?.focus();
    },
    [handleTerminalCwd, ports],
  );

  const handleSwitchTerminalAgent = useCallback(
    (leafId: number, command: string | null) => {
      const tab = ports.tabsRef.current.find(
        (item): item is TerminalTab =>
          item.kind === "terminal" && hasLeaf(item.paneTree, leafId),
      );
      if (!tab) return;
      const cwd = findLeafCwd(tab.paneTree, leafId) ?? tab.cwd;
      ports.setLeafLaunchCommand(leafId, command);
      const workspace =
        ports.workspacesRef.current.find((item) => item.tabId === tab.id) ??
        ports.workspacesRef.current.find((item) => item.id === ports.activeWorkspaceId);
      if (workspace) {
        const paneIndex = leafIds(tab.paneTree).indexOf(leafId);
        if (paneIndex !== -1) {
          ports.workspacePaneLaunchAtRef.current.set(
            `${workspace.id}:${paneIndex}`,
            Date.now(),
          );
          const pane = ports.buildPaneRecord(
            workspace.id,
            paneIndex,
            cwd ?? null,
            command,
            Boolean(command),
            ports.persistedPaneFor(workspace.id, paneIndex),
            null,
            "clear",
          );
          void ports.persistPaneRecord(pane).catch((error) =>
            console.error("Failed to save switched terminal agent:", error),
          );
          if (pane.agentProvider && !pane.nativeSessionId) {
            ports.scheduleWorkspacePaneSessionSync(workspace.id, cwd ?? workspace.workingFolder);
          }
        }
      }
      void ports.replaceSessionCommand(leafId, cwd, command).finally(() => {
        ports.terminalRefs.current.get(leafId)?.focus();
      });
    },
    [ports],
  );

  const handleTerminalCommand = useCallback(
    (leafId: number, command: string) => {
      ports.pendingVoiceDraftsRef.current.delete(leafId);
      const tab = ports.tabsRef.current.find(
        (item): item is TerminalTab =>
          item.kind === "terminal" && hasLeaf(item.paneTree, leafId),
      );
      if (!tab) return;
      const workspace = ports.workspacesRef.current.find((item) => item.tabId === tab.id);
      if (!workspace) return;
      const paneIndex = leafIds(tab.paneTree).indexOf(leafId);
      if (paneIndex === -1) return;
      const workingFolder = findLeafCwd(tab.paneTree, leafId) ?? null;
      const autoLaunch = findLeafAutoLaunch(tab.paneTree, leafId);
      const isCliAgent = Boolean(command.trim()) && ports.buildPaneRecord(
        workspace.id,
        paneIndex,
        workingFolder,
        command,
        true,
      ).agentProvider !== null;
      if (isCliAgent) {
        ports.setLeafLaunchCommand(leafId, command);
        ports.workspacePaneLaunchAtRef.current.set(`${workspace.id}:${paneIndex}`, Date.now());
      }
      const existingPane = ports.persistedPaneFor(workspace.id, paneIndex);
      const configuredCommand = isCliAgent
        ? command
        : autoLaunch
          ? existingPane?.lastCommand ?? findLeafLastCommand(tab.paneTree, leafId) ?? null
          : null;
      const pane = ports.buildPaneRecord(
        workspace.id,
        paneIndex,
        workingFolder,
        configuredCommand,
        isCliAgent || autoLaunch,
        existingPane,
        null,
        isCliAgent ? "clear" : "preserve",
      );
      void ports.persistPaneRecord(pane).catch((error) =>
        console.error("Failed to save terminal pane command to DB:", error),
      );
      if (pane.agentProvider && !pane.nativeSessionId) {
        ports.scheduleWorkspacePaneSessionSync(workspace.id, workingFolder ?? workspace.workingFolder);
      }
    },
    [ports],
  );

  return { handleTerminalCwd, changeTerminalDirectory, handleSwitchTerminalAgent, handleTerminalCommand };
}

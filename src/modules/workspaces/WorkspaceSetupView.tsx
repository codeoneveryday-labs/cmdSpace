import { useState } from "react";
import {
  getEnabledCliAgentDefinitions,
} from "@/modules/terminal/lib/cliAgents";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { worktreeGroup } from "@/modules/ai/lib/agentWorktree";
import type { WorkspaceItem, WorkspaceMode } from "./WorkspacesPanel";
import {
  normalizeWorkspaceAccentColor,
} from "./WorkspaceRowPrimitives";
import {
  type ImportableAgentSession,
} from "./lib/importSessions";
import {
  TERMINAL_COUNTS,
  buildWorkspaceLaunchCommands,
  resolveEffectiveAgentCommands,
} from "./lib/workspaceSetupModel";
import { useWorkspaceSetupAgentCapacity } from "./lib/useWorkspaceSetupAgentCapacity";
import { useWorkspaceSetupCommandPersistence } from "./lib/useWorkspaceSetupCommandPersistence";
import { useWorkspaceSetupFolder } from "./lib/useWorkspaceSetupFolder";
import { useWorkspaceSetupKeyboardShortcuts } from "./lib/useWorkspaceSetupKeyboardShortcuts";
import { useWorkspaceSetupOpenWorkspace } from "./lib/useWorkspaceSetupOpenWorkspace";
import { useWorkspaceSetupImportSelection } from "./lib/useWorkspaceSetupImportSelection";
import { useWorkspaceSetupIdentitySync } from "./lib/useWorkspaceSetupIdentitySync";
import { useWorkspaceSetupStateGuards } from "./lib/useWorkspaceSetupStateGuards";
import { useWorkspaceSetupNavigation } from "./lib/useWorkspaceSetupNavigation";
import { WorkspaceSetupLayoutStep } from "./WorkspaceSetupLayoutStep";
import { WorkspaceSetupAgentsStep } from "./WorkspaceSetupAgentsStep";
import { WorkspaceSetupFooter } from "./WorkspaceSetupFooter";

export function WorkspaceSetupView({
  workingFolder,
  suggestedWorkspaceName,
  suggestedWorkspaceColor,
  recentWorkspaces,
  onCancel,
  onOpenWithoutAi,
}: {
  workingFolder: string | null;
  suggestedWorkspaceName: string;
  suggestedWorkspaceColor: string;
  recentWorkspaces: WorkspaceItem[];
  onCancel: () => void;
  onOpenWithoutAi: (
    terminalCount: number,
    workingFolder: string | null,
    initialCommands?: string[],
    workspaceName?: string,
    workspaceColor?: string,
    workspaceMode?: WorkspaceMode,
  ) => void;
}) {
  const [workspaceName, setWorkspaceName] = useState(suggestedWorkspaceName);
  const [workspaceColor, setWorkspaceColor] = useState(
    normalizeWorkspaceAccentColor(suggestedWorkspaceColor),
  );
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [folderCommand, setFolderCommand] = useState("");
  const [terminalCount, setTerminalCount] =
    useState<(typeof TERMINAL_COUNTS)[number]>(1);
  const [workspaceMode, setWorkspaceMode] =
    useState<WorkspaceMode>("standard");
  const [setupStep, setSetupStep] = useState<"layout" | "agents">("layout");
  const [importSessionPickerOpen, setImportSessionPickerOpen] = useState(false);
  const [selectedImportSessions, setSelectedImportSessions] = useState<
    ImportableAgentSession[]
  >([]);
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});
  const [isolateAgentWorktrees, setIsolateAgentWorktrees] = useState(false);
  const [agentWorktreeGroup] = useState(worktreeGroup);
  const configuredCliAgentIds = usePreferencesStore((s) => s.cliAgentIds);
  const disabledCliAgentIds = usePreferencesStore(
    (s) => s.disabledCliAgentIds,
  );
  const configuredAgentCliOptions = getEnabledCliAgentDefinitions(
    configuredCliAgentIds,
    disabledCliAgentIds,
  );
  const {
    storedAgentCommands,
    agentCommandDrafts,
    setAgentCommandDrafts,
    customCommand,
    customCommandLoaded,
    handleCustomCommandChange,
    persistAgentCommand,
    persistCustomCommand,
  } = useWorkspaceSetupCommandPersistence();
  const { handleBrowse, handleApplyFolderCommand } = useWorkspaceSetupFolder({
    workingFolder,
    selectedFolder,
    folderCommand,
    setSelectedFolder,
    setFolderCommand,
  });
  const recentFolders = recentWorkspaces
    .filter((workspace) => Boolean(workspace.workingFolder))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 6);
  const {
    assignedAgentTerminals,
    remainingAgentSlots,
    cliTerminalCapacity,
    setAgentCount,
  } = useWorkspaceSetupAgentCapacity({
    terminalCount,
    selectedImportSessionCount: selectedImportSessions.length,
    agentCounts,
    configuredAgentIds: configuredAgentCliOptions.map((agent) => agent.id),
    disabledAgentIds: disabledCliAgentIds,
    setAgentCounts,
  });
  // Effective launch command per agent: user override wins, else launch,
  // else the bare command.
  const effectiveAgentCommands = resolveEffectiveAgentCommands(
    configuredAgentCliOptions,
    agentCommandDrafts,
    storedAgentCommands,
  );
  const plannedAgentCommands = buildWorkspaceLaunchCommands({
    agentCounts,
    customCommand,
    effectiveCommands: effectiveAgentCommands,
    selectedImportSessions,
    cliTerminalCapacity,
    isolateAgentWorktrees,
    agentWorktreeGroup,
  });
  const visibleAgents = configuredAgentCliOptions;
  const selectImportSessions = useWorkspaceSetupImportSelection({
    remainingAgentSlots,
    selectedImportSessions,
    setSelectedImportSessions,
  });

  useWorkspaceSetupIdentitySync({
    suggestedWorkspaceName,
    suggestedWorkspaceColor,
    setWorkspaceName,
    setWorkspaceColor,
  });

  const openWorkspace = useWorkspaceSetupOpenWorkspace({
    terminalCount,
    selectedFolder,
    workspaceName,
    workspaceColor,
    workspaceMode,
    agentCounts,
    selectedImportSessions,
    effectiveAgentCommands,
    customCommand,
    isolateAgentWorktrees,
    agentWorktreeGroup,
    onOpenWithoutAi,
    onCancel,
  });

  const { handleBack, handlePrimaryAction } = useWorkspaceSetupNavigation({
    setupStep,
    plannedAgentCommands,
    setSetupStep,
    openWorkspace,
    onCancel,
  });

  useWorkspaceSetupKeyboardShortcuts({
    importSessionPickerOpen,
    onBack: handleBack,
    onPrimaryAction: handlePrimaryAction,
  });

  useWorkspaceSetupStateGuards({
    terminalCount,
    customCommand,
    setSelectedImportSessions,
    setAgentCounts,
  });

  return (
    <div className="flex h-full min-h-0 justify-center overflow-y-auto bg-background px-6 py-10 sm:px-10 lg:px-14">
      <div className="w-full max-w-[920px] self-start">
        <header className="mb-6 flex flex-col items-center gap-3 text-center sm:mb-8">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {setupStep === "layout"
              ? "Set up your workspace"
              : "Add AI coding agents"}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            {setupStep === "layout"
              ? "Pick a folder to work in and choose how many terminals you want."
              : `Pick which agent CLIs should launch in your ${terminalCount} terminals.`}
          </p>
        </header>

        <div className="space-y-6 sm:space-y-8">
          {setupStep === "layout" ? (
            <WorkspaceSetupLayoutStep
              workspaceName={workspaceName}
              suggestedWorkspaceName={suggestedWorkspaceName}
              workspaceColor={workspaceColor}
              suggestedWorkspaceColor={suggestedWorkspaceColor}
              setWorkspaceName={setWorkspaceName}
              setWorkspaceColor={setWorkspaceColor}
              workspaceMode={workspaceMode}
              setWorkspaceMode={setWorkspaceMode}
              terminalCount={terminalCount}
              setTerminalCount={setTerminalCount}
              selectedFolder={selectedFolder}
              setSelectedFolder={setSelectedFolder}
              folderCommand={folderCommand}
              setFolderCommand={setFolderCommand}
              handleBrowse={handleBrowse}
              handleApplyFolderCommand={handleApplyFolderCommand}
              recentFolders={recentFolders}
            />
          ) : (
            <WorkspaceSetupAgentsStep
              assignment={{
                assignedAgentTerminals,
                terminalCount,
                remainingAgentSlots,
                isolateAgentWorktrees,
                setIsolateAgentWorktrees,
                selectedImportSessions,
                setSelectedImportSessions,
                setImportSessionPickerOpen,
              }}
              selection={{
                visibleAgents,
                agentCounts,
                remainingAgentSlots,
                customCommand,
                customCommandLoaded,
                effectiveAgentCommands,
                setAgentCount,
                setAgentCommandDrafts,
                persistAgentCommand,
                setCustomCommand: handleCustomCommandChange,
                persistCustomCommand,
              }}
              importDialog={{
                open: importSessionPickerOpen,
                onOpenChange: setImportSessionPickerOpen,
                workspaceName: workspaceName || suggestedWorkspaceName,
                workspaceCwd: selectedFolder || null,
                actionLabel: "Add",
                multiple: true,
                onImport: (session) => selectImportSessions([session]),
                onImportMany: selectImportSessions,
              }}
            />
          )}
        </div>

        <WorkspaceSetupFooter
          setupStep={setupStep}
          terminalCount={terminalCount}
          plannedAgentCommands={plannedAgentCommands}
          onBack={handleBack}
          onOpenWorkspace={openWorkspace}
          onPrimaryAction={handlePrimaryAction}
        />
      </div>
    </div>
  );
}

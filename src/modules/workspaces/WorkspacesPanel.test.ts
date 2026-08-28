import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const panelPath = path.join(here, "WorkspacesPanel.tsx");
const appPath = path.join(here, "../../app/App.tsx");
const appConstantsPath = path.join(here, "../../app/constants.ts");
const workspacePersistencePath = path.join(
  here,
  "../../app/lib/useWorkspacePersistence.ts",
);
const workspaceSelectionPath = path.join(
  here,
  "../../app/lib/useWorkspaceSelection.ts",
);
const headerPath = path.join(here, "../header/Header.tsx");
const useTabsPath = path.join(here, "../tabs/lib/useTabs.ts");
const rendererPoolPath = path.join(here, "../terminal/lib/rendererPool.ts");
const dbPath = path.join(here, "../../../src-tauri/src/modules/db.rs");
const cliAgentsPath = path.join(here, "../terminal/lib/cliAgents.ts");
const agentCliIconPath = path.join(here, "../terminal/AgentCliIcon.tsx");

describe("WorkspacesPanel", () => {
  it("provides the left workspaces surface shown in the app shell", () => {
    expect(existsSync(panelPath), "WorkspacesPanel.tsx exists").toBe(true);

    const panelSource = readFileSync(panelPath, "utf8");
    const appSource = readFileSync(appPath, "utf8");
    const appConstantsSource = readFileSync(appConstantsPath, "utf8");
    const workspacePersistenceSource = readFileSync(
      workspacePersistencePath,
      "utf8",
    );
    const workspaceSelectionSource = readFileSync(workspaceSelectionPath, "utf8");
    const headerSource = readFileSync(headerPath, "utf8");
    const useTabsSource = readFileSync(useTabsPath, "utf8");
    const rendererPoolSource = readFileSync(rendererPoolPath, "utf8");
    const cliAgentsSource = readFileSync(cliAgentsPath, "utf8");
    const agentCliIconSource = readFileSync(agentCliIconPath, "utf8");

    expect(panelSource).toContain("onCloseTerminal");
    expect(panelSource).toContain("aria-label={`Close ${terminal.label}`}");
    expect(panelSource).toContain("event.stopPropagation()");
    expect(panelSource).toContain("WORKSPACES");
    expect(panelSource).toContain("TerminalAgentSwitcher");
    expect(panelSource).toContain("onCreateTerminal(command ?? undefined)");
    expect(panelSource).toContain("canCreate={");
    expect(panelSource).not.toContain('workspace.workspaceMode !== "agent"');
    expect(panelSource).not.toContain('workspace.workspaceMode !== "canvas"');
    expect(appSource).toContain('workspace.workspaceMode === "agent"');
    expect(appSource).toContain('workspace.workspaceMode === "canvas"');
    expect(appSource).toContain("canvasTerminalCreatorRef");
    expect(appSource).toContain("Failed to persist created workspace terminal");
    expect(panelSource).toContain("Set up your workspace");
    expect(panelSource).toContain("Workspace mode");
    expect(panelSource).toContain("Standard workspace");
    expect(panelSource).toContain("Canvas workspace");
    expect(panelSource).toContain("Agent chat workspace");
    expect(appSource).not.toContain("sendAgentWorkspacePrompt");
    expect(panelSource).toContain("WorkspaceModeIcon");
    expect(panelSource).toContain('workspace.workspaceMode === "canvas"');
    expect(panelSource).toContain('workspace.workspaceMode === "agent"');
    expect(panelSource).toContain("CanvasIcon");
    expect(panelSource).toContain("ComputerTerminal02Icon");
    expect(panelSource).toContain("Canvas workspace");
    expect(panelSource).toContain("Standard terminal workspace");
    expect(panelSource).toContain(
      'useState<WorkspaceMode>(forkContext ? "agent" : "standard")',
    );
    expect(panelSource).toContain("Chat history");
    expect(panelSource).toContain("Previous conversation");
    expect(panelSource).toContain("Fork workspace message");
    expect(panelSource).toContain("Create workspace");
    expect(panelSource).toContain("workspaceMode?: WorkspaceMode");
    expect(panelSource).toContain("Workspace name");
    expect(panelSource).toContain("Shown in the workspace list and tab");
    expect(panelSource).toContain("const [workspaceName, setWorkspaceName]");
    expect(panelSource).toContain("const [workspaceColor, setWorkspaceColor]");
    expect(panelSource).toContain("suggestedWorkspaceName");
    expect(panelSource).toContain("suggestedWorkspaceColor");
    expect(panelSource).toContain('aria-label="Workspace name"');
    expect(panelSource).toContain("Working folder");
    expect(panelSource).toContain("workingFolder");
    expect(panelSource).toContain("folderCommand");
    expect(panelSource).toContain("Change working folder command");
    expect(panelSource).toContain("Apply working folder command");
    expect(panelSource).toContain('placeholder="cd folder-name"');
    expect(panelSource).toContain("export function WorkspaceSetupView");
    expect(panelSource).toContain("onStartWorkspaceSetup");
    expect(panelSource).toContain("onClick={onStartWorkspaceSetup}");
    expect(panelSource).not.toContain("DialogContent");
    expect(panelSource).not.toContain("WorkspaceSetupDialog");
    expect(panelSource).toContain("recentFolders");
    expect(panelSource).toContain("Recents");
    expect(panelSource).toContain("{recentFolders.length}");
    expect(panelSource).toContain(".slice(0, 6)");
    expect(panelSource).toContain("Last opened workspaces");
    expect(panelSource).toContain("WORKSPACE_SETUP_PRESETS");
    expect(panelSource).toContain("Presets");
    expect(panelSource).toContain("WORKSPACE_SETUP_PRESETS.length");
    expect(panelSource).toContain("setTerminalCount(preset.count)");
    expect(panelSource).toContain('name: "Focus"');
    expect(panelSource).toContain('name: "Lab"');
    expect(panelSource).toContain("AGENT_CLI_OPTIONS");
    expect(panelSource).toContain("getEnabledCliAgentDefinitions");
    expect(panelSource).toContain("configuredAgentCliOptions");
    expect(panelSource).toContain("AgentCliIcon");
    expect(panelSource).toContain('<AgentCliIcon agent={agent.id} size="md" />');
    expect(agentCliIconSource).toContain("getAgentBrandIcon");
    expect(agentCliIconSource).toContain("<BrandIcon");
    expect(panelSource).toContain("Add AI coding agents");
    expect(panelSource).not.toContain("Quick fill:");
    expect(panelSource).not.toContain("One of each");
    expect(panelSource).not.toContain("Split evenly");
    expect(panelSource).not.toContain("fillOneOfEachAgent");
    expect(panelSource).not.toContain("splitAgentsEvenly");
    expect(panelSource).toContain("availableAgents");
    expect(panelSource).toContain(
      "const availableAgents = configuredAgentCliOptions",
    );
    expect(panelSource).not.toContain("chatAgentOptions");
    expect(panelSource).toContain("resolveAgentChatWorkspaceAgents");
    expect(panelSource).not.toContain("chatTransport !== undefined");
    expect(panelSource).not.toContain("installedAgents");
    expect(panelSource).not.toContain("Scanning installed agents");
    expect(panelSource).toContain(
      'invoke<string>("db_load_workspace_setup_custom_command")',
    );
    expect(panelSource).toContain(
      'invoke("db_save_workspace_setup_custom_command",',
    );
    expect(panelSource).toContain("agentLaunchCommands");
    expect(panelSource).toContain("effectiveAgentCommands");
    expect(panelSource).toContain("persistAgentCommand");
    expect(panelSource).toContain("setAgentLaunchCommands");
    expect(cliAgentsSource).toContain('name: "Claude Code"');
    expect(cliAgentsSource).toContain('name: "Codex"');
    expect(cliAgentsSource).toContain('name: "OpenCode"');
    expect(cliAgentsSource).toContain('name: "Gemini CLI"');
    expect(cliAgentsSource).toContain('name: "Kimi Code"');
    expect(cliAgentsSource).toContain('name: "Grok CLI"');
    expect(cliAgentsSource).toContain('name: "Command Code"');
    for (const name of [
      "GitHub Copilot",
      "Cursor Agent",
      "Aider",
      "Pi Coding Agent",
      "Amp CLI",
      "Cline CLI",
      "Goose",
      "Qwen Code",
      "OpenHands CLI",
      "Kiro CLI",
    ]) {
      expect(cliAgentsSource).toContain(name);
    }
    expect(cliAgentsSource).toContain("UNATTENDED_LAUNCH_FLAGS");
    expect(cliAgentsSource).toContain('claude: "--dangerously-skip-permissions"');
    expect(cliAgentsSource).toContain(
      'codex: "--dangerously-bypass-approvals-and-sandbox"',
    );
    expect(cliAgentsSource).toContain('cmd: "--dangerously-skip-permissions"');
    expect(cliAgentsSource).toContain("function unattendedLaunch");
    expect(cliAgentsSource).toContain('launchPolicy: "unattended"');
    expect(panelSource).not.toContain("CODEX_CONFIG");
    expect(panelSource).not.toContain("trust_level");
    expect(panelSource).not.toContain("expect -c");
    expect(panelSource).not.toContain("spawn ");
    expect(panelSource).toContain("Custom");
    expect(panelSource).not.toContain("BridgeCode");
    expect(panelSource).not.toContain("Grok Build");
    expect(panelSource).not.toContain("Antigravity");
    expect(panelSource).not.toContain("npm install");
    expect(panelSource).not.toContain("curl -fsSL");
    expect(panelSource).not.toContain("git worktree");
    expect(panelSource).not.toContain("worktree_parent");
    expect(panelSource).not.toContain("command -v");
    expect(panelSource).toContain("function buildAgentCliCommand");
    expect(panelSource).toContain("function agentCommandPlan");
    expect(panelSource).toContain("plannedAgentCommands");
    expect(panelSource).toContain("Isolate agent changes in Git worktrees");
    expect(panelSource).toContain("isolatedAgentCommand");
    expect(panelSource).toContain("initialCommands?: string[]");
    expect(panelSource).toContain('setSetupStep("agents")');
    expect(panelSource).toContain("Skip - no agents");
    expect(panelSource).toContain("Launch ${terminalCount} terminals");
    expect(panelSource).toContain("isEditableKeyboardTarget");
    expect(panelSource).toContain(
      'window.addEventListener("keydown", handleKeyboardShortcut)',
    );
    expect(panelSource).toContain(
      'window.removeEventListener("keydown", handleKeyboardShortcut)',
    );
    expect(panelSource).toContain('event.key === "Escape"');
    expect(panelSource).toContain("handlePrimaryAction");
    expect(panelSource).toContain("handleBack");
    expect(panelSource).toContain("function recentWorkspaceFolderLabel");
    expect(panelSource).toContain("function coerceTerminalCount");
    expect(panelSource).toContain("const [terminalCount, setTerminalCount]");
    expect(panelSource).toContain("coerceTerminalCount(workspace.count)");
    expect(panelSource).toContain("setWorkspaceName(workspace.name)");
    expect(panelSource).toContain("setWorkspaceColor(");
    expect(panelSource).toContain("function resolveFolderCommand");
    expect(panelSource).toContain("/^cd(?:\\s+(.+))?$/i");
    expect(panelSource).toContain("function resolveWorkspacePath");
    expect(panelSource).toContain("function normalizeWorkspacePath");
    expect(panelSource).toContain("function inferHomePath");
    expect(panelSource).not.toContain("/Users/matthewmiller");
    expect(panelSource).toContain("onOpenWithoutAi");
    expect(panelSource).toContain("How many terminals?");
    expect(panelSource).toContain(
      "justify-center overflow-y-auto bg-background",
    );
    expect(panelSource).toContain("w-full max-w-[920px] self-start");
    expect(panelSource).not.toContain(
      "rounded-2xl border border-border/60 bg-background/95",
    );
    expect(panelSource).toContain("max-w-[920px]");
    expect(panelSource).toContain(
      "grid-cols-[repeat(auto-fit,minmax(72px,1fr))]",
    );
    expect(panelSource).toContain(
      "mt-2 flex flex-col gap-3 pt-2 sm:mt-3",
    );
    expect(panelSource).toContain("Fork workspace message");
    expect(panelSource).toContain(
      "sm:flex-row sm:items-center sm:justify-between",
    );
    expect(panelSource).toContain("renderedWorkspaces.flatMap");
    expect(panelSource).not.toContain("native.gitResolveRepo(cwd)");
    expect(panelSource).not.toContain("native.workspaceAuthorize(cwd)");
    expect(panelSource).not.toContain('git diff HEAD --shortstat');
    expect(panelSource).not.toContain("WorkspaceGitMeta");
    expect(panelSource).toContain("No workspaces yet");
    expect(panelSource).toContain("onDoubleClick");
    expect(panelSource).toContain("setRenaming(true)");
    expect(panelSource).toContain("const handleRowSelect");
    expect(panelSource).toContain('target.closest("button")');
    expect(panelSource).toContain('target.closest("input")');
    expect(panelSource).toContain("onClick={handleRowSelect}");
    expect(panelSource).toContain('event.key === "Enter"');
    expect(panelSource).toContain('event.key === "Escape"');
    expect(panelSource).toContain("onRenameWorkspace");
    expect(panelSource).toContain("WORKSPACE_ACCENT_COLORS");
    expect(panelSource).toContain("WorkspaceColorPicker");
    expect(panelSource).toContain("onChangeWorkspaceColor");
    expect(panelSource).toContain("Change color for");
    expect(panelSource).toContain('role="listbox"');
    expect(panelSource).toContain("colorWithAlpha");
    expect(panelSource).not.toContain("border-blue-500/35 bg-blue-500/[0.10]");
    expect(panelSource).not.toContain("bg-emerald-400 shadow");
    expect(panelSource).not.toContain("BridgeMind");
    expect(panelSource).not.toContain("GPT 5.5");
    expect(panelSource).not.toContain("Toggle workspaces panel");
    expect(panelSource).not.toContain("GridViewIcon");
    expect(panelSource).not.toContain("SidebarLeftIcon");
    expect(panelSource).toContain("aria-current");
    expect(panelSource).toContain("compact?: boolean");
    expect(panelSource).toContain("compact = false");
    expect(panelSource).toContain("title={workspace.name}");
    expect(panelSource).toContain("aria-label={workspace.name}");
    expect(appSource).toContain("workspacesPanelOpen");
    expect(appSource).toContain("toggleWorkspacesPanel");
    expect(appSource).toContain("setWorkspacesPanelOpen");
    expect(appSource).not.toContain("WORKSPACES_PANEL_COLLAPSED_WIDTH = 42");
    expect(appSource).not.toContain('id="workspaces"');
    expect(appSource).not.toContain("panelRef={workspacesRef}");
    expect(appSource).toContain("WORKSPACES_PANEL_MIN_WIDTH");
    expect(appSource).toContain("WORKSPACES_PANEL_MAX_WIDTH");
    expect(appConstantsSource).toContain(
      "WORKSPACES_PANEL_COMPACT_WIDTH = 152",
    );
    expect(appConstantsSource).toContain(
      'WORKSPACES_PANEL_WIDTH_STORAGE_KEY = "cmdspace.workspaces.width"',
    );
    expect(appConstantsSource).toContain(
      "WORKSPACES_PANEL_COMPACT_BREAKPOINT = 1180",
    );
    expect(appSource).toContain("workspacesPanelCompact");
    expect(appSource).toContain("shouldUseCompactWorkspacesPanel");
    expect(appSource).toContain(
      "const workspacesPanelWidth = workspacesPanelCompact",
    );
    expect(appSource).toContain(
      "width: workspacesPanelOpen ? workspacesPanelWidth : 0",
    );
    expect(appSource).toContain("style={{ width: workspacesPanelWidth }}");
    expect(appSource).toContain("compact={workspacesPanelCompact}");
    expect(appSource).toContain('"flex min-h-0 min-w-0 flex-1"');
    expect(appSource).toContain("newWorkspaceTab");
    expect(appSource).toContain("formatWorkspaceName");
    expect(appSource).toContain("workspace-");
    expect(appSource).toContain("workspace-tab-");
    expect(appSource).toContain("workspace.id, workspace.name");
    expect(appConstantsSource).toContain("WORKSPACE_LIMIT = 99");
    expect(appSource).toContain("setWorkspaces");
    expect(appSource).toContain("workspaceItems");
    expect(appSource).toContain("leafIds(tab.paneTree).length");
    expect(appSource).toContain("handleOpenWorkspaceWithoutAi");
    expect(appSource).toContain("workspaceMode: WorkspaceMode = \"standard\"");
    expect(appSource).toContain("function canvasWorkspaceDiagram");
    expect(appSource).toContain("canvasWorkspaceDiagram(");
    expect(workspacePersistenceSource).toContain(
      "item.canvasTabId === currentTabId",
    );
    expect(workspaceSelectionSource).toContain("function countTerminalNodes");
    expect(workspaceSelectionSource).toContain(
      'filter((node) => node.kind === "terminal")',
    );
    expect(appSource).toContain('count: workspaceMode === "agent" ? agentTabIds.length : terminalCount');
    expect(appSource).toContain("workspaceMode === \"canvas\"");
    expect(appSource).toContain("tabId: workspaceMode === \"canvas\" ? null : tabId");
    expect(appSource).toContain("initialCommands: string[] = []");
    expect(appSource).toContain("requestedName?: string");
    expect(appSource).toContain("requestedColor?: string");
    expect(appSource).toContain("requestedName?.trim() || fallbackName");
    expect(appSource).toContain("suggestedWorkspaceName={");
    expect(appSource).toContain(
      "suggestedWorkspaceColor={workspaceAccentForIndex",
    );
    expect(appSource).toContain("normalizeWorkspaceAccentColor(");
    expect(appSource).toContain("const paneLaunchPlan");
    expect(appSource).toContain(
      "lastCommand: initialCommands[paneIndex] ?? null",
    );
    expect(appSource).toContain(
      "autoLaunch: Boolean(initialCommands[paneIndex])",
    );
    expect(appSource).toContain("paneLaunchPlan");
    expect(appSource).toContain("savePaneLaunchPlan");
    expect(appSource).toContain("db_save_pane");
    expect(appSource).toContain("workspaceSetupOpen");
    expect(appSource).toContain("setWorkspaceSetupOpen(true)");
    expect(appSource).toContain("if (hydrated.length === 0) setWorkspaceSetupOpen(true);");
    expect(appSource).toContain("const handleWorkspaceSetupCancel");
    expect(appSource).toContain("<WorkspaceSetupView");
    expect(appSource).toContain("onCancel={handleWorkspaceSetupCancel}");
    expect(appSource).toContain("handleSelectWorkspace");
    expect(appSource).toContain("handleCloseWorkspace");
    expect(appSource).toContain("handleRenameWorkspace");
    expect(panelSource).not.toContain("border-r border-border/60");
    expect(appSource).toMatch(
      /<WorkspacesPanel[\s\S]*workspaces=\{workspaceItems\}[\s\S]*onRenameWorkspace=\{handleRenameWorkspace\}[\s\S]*onStartWorkspaceSetup=\{\(\) => setWorkspaceSetupOpen\(true\)\}/,
    );
    expect(appSource).toContain("recentWorkspaces={recentWorkspaces}");
    expect(appSource).toContain("workingFolder={workspaceForkContext?.cwd ?? workspaceSetupFolder}");
    expect(appSource).toContain("forkContext={workspaceForkContext}");
    expect(appSource).toContain("db_list_recent_workspaces");
    expect(appSource).toContain("db_save_recent_workspace");
    expect(appSource).toContain("saveRecentWorkspace(newWs)");
    expect(appSource).toMatch(
      /<Header[\s\S]*onToggleWorkspacesPanel=\{toggleWorkspacesPanel\}/,
    );
    expect(appSource).not.toMatch(
      /<WorkspacesPanel\s+onToggleSidebar=\{toggleSidebar\}\s*\/>/,
    );
    expect(headerSource).toContain("onToggleWorkspacesPanel");
    expect(headerSource).toContain("Toggle workspaces panel");
    expect(useTabsSource).toContain("function createPaneTree");
    expect(useTabsSource).toContain("function terminalGridShape");
    expect(useTabsSource).toContain("columns: 2, rows: 3");
    expect(useTabsSource).toContain("columns: 3, rows: 4");
    expect(useTabsSource).toContain("const buildColumn");
    expect(useTabsSource).toContain("const newWorkspaceTab");
    expect(useTabsSource).toContain("paneLayout?: string | null");
    expect(useTabsSource).toContain("parseSavedPaneLayout(paneLayout)");
    expect(useTabsSource).toContain("setTerminalPaneTree");
    expect(useTabsSource).toContain("MAX_PANES_PER_TAB = 12");
    expect(rendererPoolSource).toContain("POOL_MAX_SIZE = 12");
    expect(rendererPoolSource).toContain("webglDisabledAfterContextLoss");
    expect(rendererPoolSource).not.toContain("WEBGL_RECOVERY_DELAY_MS");
  });

  it("does not persist runtime shell history as a workspace launch command", () => {
    const appSource = readFileSync(appPath, "utf8");
    const dbSource = readFileSync(dbPath, "utf8");

    expect(appSource).not.toContain("setLeafLastCommand(leafId, command)");
    expect(appSource).toContain(
      "const autoLaunch = findLeafAutoLaunch(tab.paneTree, leafId);",
    );
    expect(appSource).toContain("const isCliAgent = detectCliAgent(command) !== null;");
    expect(appSource).toContain("const configuredCommand = isCliAgent");
    expect(appSource).toContain(": autoLaunch");
    expect(appSource).toContain("autoLaunch,");
    expect(dbSource).toContain("auto_launch INTEGER NOT NULL DEFAULT 0");
    expect(dbSource).toContain(
      "ALTER TABLE workspace_panes ADD COLUMN auto_launch INTEGER NOT NULL DEFAULT 0",
    );
    expect(dbSource).toContain("auto_launch: row.get(4)?");
  });

  it("nests terminal navigation under expandable workspace rows", () => {
    const source = readFileSync(panelPath, "utf8");

    expect(source).toContain("expandedWorkspaceIds");
    expect(source).toContain("toggleWorkspaceExpanded");
    expect(source).toContain("onToggleExpanded");
    expect(source).toContain("Show terminals for");
    expect(source).toContain("Hide terminals for");
    expect(source).toContain("workspace.terminals");
    expect(source).not.toContain("activeWorkspaceCodingAgentCount: number");
    expect(source).not.toContain("Coding agents");
  });

  it("supports swapping terminal positions from the sidebar", () => {
    const panelSource = readFileSync(panelPath, "utf8");
    const appSource = readFileSync(appPath, "utf8");

    expect(panelSource).toContain("onSwapTerminals");
    expect(panelSource).toContain("data-terminal-leaf-id");
    expect(appSource).toContain("handleSwapWorkspaceTerminals");
    expect(appSource).toContain("swapLeafNodes(");
    expect(appSource).toContain("handleTerminalPaneTreeChange(tab.id, paneTree)");
  });

  it("renders the terminal drag preview outside the transformed zoom container", () => {
    const source = readFileSync(panelPath, "utf8");

    expect(source).toContain('import { createPortal } from "react-dom";');
    expect(source).toContain("createPortal(");
    expect(source).toContain("document.body");
  });

  it("keeps the dragged terminal's agent logo in the preview", () => {
    const source = readFileSync(panelPath, "utf8");

    expect(source).toContain("draggedTerminal?.agent");
    expect(source).toContain(
      '<AgentCliIcon agent={draggedTerminal.agent} size="md" />',
    );
  });
});

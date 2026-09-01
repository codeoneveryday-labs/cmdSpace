import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const appPath = path.join(here, "App.tsx");
const runtimeBootstrapPath = path.join(here, "lib/useAppRuntimeBootstrap.ts");
const workspaceDeleteDialogPath = path.join(here, "WorkspaceDeleteDialog.tsx");
const shortcutCoordinationPath = path.join(here, "lib/appShortcutCoordination.ts");
const bottomTerminalControllerPath = path.join(here, "lib/useBottomTerminalController.ts");
const activeContextPath = path.join(here, "lib/useAppActiveContext.ts");
const chromeActionsPath = path.join(here, "lib/useAppChromeActions.ts");
const workspaceDeletionPath = path.join(here, "lib/useWorkspaceDeletion.ts");
const workspaceDeleteConfirmationPath = path.join(here, "lib/useWorkspaceDeleteConfirmation.ts");
const workspaceSetupActionsPath = path.join(here, "lib/useWorkspaceSetupActions.ts");
const workspaceCreationActionPath = path.join(
  here,
  "lib/workspaceCreationAction.ts",
);
const workspaceRecordActionsPath = path.join(
  here,
  "lib/useWorkspaceRecordActions.ts",
);
const appConstantsPath = path.join(here, "constants.ts");
const shortcutsPath = path.join(here, "../modules/shortcuts/shortcuts.ts");

describe("App sidebar toggle", () => {
  it("does not orphan a workspace when its tab is transiently absent during resume", () => {
    const source = readFileSync(appPath, "utf8");

    expect(source).not.toContain(
      "workspace.tabId !== null && !tabIds.has(workspace.tabId)",
    );
    expect(source).toContain("clearWorkspaceTabOwnership");
  });

  it("switches an agent in place and persists the pane launch plan", () => {
    const source = readFileSync(appPath, "utf8");
    const controller = [
      readFileSync(path.join(here, "lib/useWorkspaceController.ts"), "utf8"),
      readFileSync(workspaceCreationActionPath, "utf8"),
    ].join("\n");
    const actions = readFileSync(path.join(here, "lib/useTerminalWorkspaceActions.ts"), "utf8");

    expect(source).toContain("handleSwitchTerminalAgent");
    expect(actions).toContain("ports.setLeafLaunchCommand(leafId, command)");
    expect(actions).toContain("ports.replaceSessionCommand(leafId, cwd, command)");
    expect(controller).toContain('invoke("db_save_pane"');
  });

  it("publishes manual CLI-agent launches back into the live pane tree", () => {
    const actions = readFileSync(path.join(here, "lib/useTerminalWorkspaceActions.ts"), "utf8");
    const matches = actions.match(/setLeafLaunchCommand\(leafId, command\)/g) ?? [];

    expect(actions).toContain("const isCliAgent = Boolean(command.trim())");
    expect(actions).toContain("if (isCliAgent) {");
    expect(matches).toHaveLength(2);
  });

  it("persists agent chat session identity for every CLI provider instead of Codex only", () => {
    const source = readFileSync(appPath, "utf8");
    const surface = readFileSync(path.join(here, "WorkspaceSurface.tsx"), "utf8");

    expect(source).not.toContain('if (provider !== "codex") return;');
    expect(surface).toContain("nativeSessionId={tab.nativeSessionId}");
  });

  it("closing an agent chat tab preserves its persisted chat descriptor", () => {
    const source = [
      readFileSync(appPath, "utf8"),
      readFileSync(path.join(here, "lib/workspaceAgentSessionModel.ts"), "utf8"),
      readFileSync(workspaceDeletionPath, "utf8"),
      readFileSync(path.join(here, "lib/workspaceOwnershipModel.ts"), "utf8"),
    ].join("\n");

    expect(source).toContain("const agentTabIds = workspace.agentTabIds.filter((id) => id !== tabId);");
    expect(source).not.toContain("const agentProviders = (workspace.agentProviders ?? []).filter(");
    expect(source).not.toContain("const agentSessionIds = (workspace.agentSessionIds ?? []).filter(");
    expect(source).toContain("const tabIndex =");
  });

  it("opens the Paseo-style draft workspace flow before creating a forked agent session", () => {
    const source = [
      readFileSync(appPath, "utf8"),
      readFileSync(workspaceSetupActionsPath, "utf8"),
    ].join("\n");
    const controller = [
      readFileSync(path.join(here, "lib/useWorkspaceController.ts"), "utf8"),
      readFileSync(workspaceCreationActionPath, "utf8"),
    ].join("\n");

    expect(source).toContain("workspaceForkContext");
    expect(source).toContain("forkContext={workspaceForkContext}");
    expect(source).toContain("initialAgentDraft = \"\"");
    expect(controller).toContain("initialDraft: index === 0 ? input.initialAgentDraft : undefined");
  });

  it("activates a freshly created workspace instead of leaving the previous tab selected", () => {
    const controller = [
      readFileSync(path.join(here, "lib/useWorkspaceController.ts"), "utf8"),
      readFileSync(workspaceCreationActionPath, "utf8"),
    ].join("\n");

    expect(controller).toContain("const activatedTabId = tabId ?? canvasTabId;");
    expect(controller).toContain("if (activatedTabId !== null) input.setActiveId(activatedTabId);");
  });

  it("deletes every agent tab owned by a workspace", () => {
    const source = [
      readFileSync(appPath, "utf8"),
      readFileSync(path.join(here, "lib/workspaceAgentSessionModel.ts"), "utf8"),
      readFileSync(workspaceDeletionPath, "utf8"),
    ].join("\n");
    const controller = readFileSync(path.join(here, "lib/useWorkspaceController.ts"), "utf8");

    expect(source).toContain("...(workspace.agentTabIds ?? [])");
    expect(controller).toContain("for (const tabId of tabIds");
    expect(source).toContain("agentSessionIds");
  });

  it("auto-activates the first workspace only once so standalone tabs remain selectable", () => {
    const source = [
      readFileSync(appPath, "utf8"),
      readFileSync(path.join(here, "lib/appStartupViewModel.ts"), "utf8"),
    ].join("\n");
    const selection = readFileSync(path.join(here, "lib/useWorkspaceSelectionController.ts"), "utf8");

    expect(selection).toContain("setInitialActivationHandled(true)");
    expect(selection).toContain("initialActivationHandled ||");
    expect(selection).toContain("pendingBootstrapCloseRef.current = true");
    expect(source).toContain("shouldSuppressBootstrapShell(gateInput)");
    expect(source).toContain(
      "pendingBootstrapClose: pendingBootstrapCloseRef.current",
    );
    expect(source).not.toContain(
      "initialWorkspaceActivationHandledRef.current = false",
    );
  });

  it("replaces the bottom AI composer with a terminal drawer", () => {
    const source = [
      readFileSync(appPath, "utf8"),
      readFileSync(shortcutCoordinationPath, "utf8"),
    ].join("\n");

    expect(source).toContain("BottomTerminalDrawer");
    expect(source).toContain("bottomTerminalOpen");
    expect(source).toContain('"terminal.bottom": actions.toggleBottomTerminal');
    expect(source).not.toContain("data-ai-input-bar");
    expect(source).not.toContain("<AiInputBar />");
    expect(source).not.toContain("<AiInputBarConnect");
  });

  it("uses the status-bar shortcut to open the terminal drawer without AI chat controls", () => {
    const appSource = [
      readFileSync(appPath, "utf8"),
      readFileSync(path.join(here, "AppOverlays.tsx"), "utf8"),
    ].join("\n");
    const statusBarSource = readFileSync(
      path.join(here, "../modules/statusbar/StatusBar.tsx"),
      "utf8",
    );

    expect(statusBarSource).not.toContain("AgentStatusPill");
    expect(statusBarSource).not.toContain("onOpenMini");
    expect(statusBarSource).toContain('onToggleTerminal: () => void;');
    expect(statusBarSource).toContain('onClick={onToggleTerminal}');
    expect(statusBarSource).toContain('title="Open terminal"');
    expect(statusBarSource).toContain("Open terminal");
    expect(statusBarSource).not.toContain("Open AI agent");
    expect(appSource).toContain("onToggleTerminal={toggleBottomTerminal}");
  });

  it("keeps the terminal shortcut visually quiet until hover or keyboard focus", () => {
    const statusBarSource = readFileSync(
      path.join(here, "../modules/statusbar/StatusBar.tsx"),
      "utf8",
    );

    expect(statusBarSource).toContain("border-transparent bg-transparent");
    expect(statusBarSource).toContain("hover:border-border/60 hover:bg-accent");
    expect(statusBarSource).toContain("focus-visible:border-border");
  });

  it("does not offer Ask cmdSpace for selected terminal text", () => {
    const appSource = readFileSync(appPath, "utf8");
    const shortcutsSource = readFileSync(shortcutsPath, "utf8");

    expect(appSource).not.toContain("SelectionAskAi");
    expect(appSource).not.toContain("askPopup");
    expect(appSource).not.toContain("askFromSelection");
    expect(shortcutsSource).not.toContain("ai.askSelection");
  });

  it("floats the bottom terminal above the workspace instead of shrinking it", () => {
    const source = readFileSync(appPath, "utf8");

    expect(source).toContain("absolute inset-x-0 bottom-0 z-40");
    expect(source).toContain("pointer-events-none");
    expect(source).toContain("pointer-events-auto");
  });

  it("keeps workspace and right-sidebar dividers visible across the main surface", () => {
    const source = readFileSync(path.join(here, "AppChrome.tsx"), "utf8");

    expect(source).toContain("after:inset-y-0 after:left-1/2 after:w-px");
    expect(source).toContain("after:bg-border/70");
  });

  it("opens the bottom terminal from the active workspace folder", () => {
    const source = [
      readFileSync(appPath, "utf8"),
      readFileSync(bottomTerminalControllerPath, "utf8"),
      readFileSync(activeContextPath, "utf8"),
    ].join("\n");

    expect(source).toContain("activeWorkspaceFolder: activeWorkspace?.workingFolder ?? null");
    expect(source).toContain("activeWorkspaceFolder ??");
    expect(source).toContain("workspace.agentTabIds?.includes(activeId)");
  });

  it("refreshes provider keys when the main window becomes active again", () => {
    const source = [
      readFileSync(appPath, "utf8"),
      readFileSync(runtimeBootstrapPath, "utf8"),
    ].join("\n");

    expect(source).toContain('window.addEventListener("focus", reload)');
    expect(source).toContain(
      'document.addEventListener("visibilitychange", reload)',
    );
    expect(source).toContain('window.removeEventListener("focus", reload)');
    expect(source).toContain(
      'document.removeEventListener("visibilitychange", reload)',
    );
  });

  it("keeps the main sidebar toggle state-driven instead of imperative panel collapse", () => {
    const source = [
      readFileSync(appPath, "utf8"),
      readFileSync(chromeActionsPath, "utf8"),
    ].join("\n");
    const layout = readFileSync(path.join(here, "lib/useAppLayout.ts"), "utf8");
    const chrome = readFileSync(path.join(here, "AppChrome.tsx"), "utf8");

    expect(layout).toContain(
      "const [sidebarOpen, setSidebarOpen] = useState(true);",
    );
    expect(layout).toContain(
      "const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);",
    );
    expect(source).toContain("setSidebarOpen((open) => !open);");
    expect(chrome).toContain("style={{ width: sidebarOpen ? sidebarWidth : 0 }}");
    expect(source).not.toContain("p.collapse()");
    expect(source).not.toContain("p.expand()");
    expect(source).not.toContain("panel?.collapse()");
    expect(source).not.toContain("PanelImperativeHandle");
    expect(source).not.toContain("panelRef={sidebarRef}");
    expect(source).not.toContain("panel.resize(");
    expect(source).not.toContain("collapsible");
    expect(source).not.toContain("collapsedSize");
  });

  it("lets the architecture canvas focus by collapsing both sidebars together", () => {
    const source = [
      readFileSync(appPath, "utf8"),
      readFileSync(chromeActionsPath, "utf8"),
    ].join("\n");

    expect(source).toContain("const canvasFocused = !workspacesPanelOpen && !sidebarOpen;");
    expect(source).toContain("const toggleCanvasFocus = useCallback(() => {");
    expect(source).toContain("setWorkspacesPanelOpen(false);");
    expect(source).toContain("setSidebarOpen(false);");
    expect(source).toContain("setWorkspacesPanelOpen(true);");
    expect(source).toContain("setSidebarOpen(true);");
  });

  it("keeps sidebar resizing smooth and away from the browser URL field", () => {
    const source = readFileSync(appPath, "utf8");
    const layout = readFileSync(path.join(here, "lib/useAppLayout.ts"), "utf8");
    const resize = readFileSync(path.join(here, "lib/useAppLayoutResize.ts"), "utf8");
    const chrome = readFileSync(path.join(here, "AppChrome.tsx"), "utf8");

    expect(layout).toContain(
      "const [sidebarResizing, setSidebarResizing] = useState(false);",
    );
    expect(layout).toContain("sidebarResizeStartRef: useRef");
    expect(chrome).toContain("onPointerDown={onSidebarResizeStart}");
    expect(resize).toContain(
      'window.addEventListener("pointermove", handleSidebarResizeMove);',
    );
    expect(resize).toContain("handleSidebarResizeEnd");
    expect(chrome).toContain('role="separator"');
    expect(chrome).toContain("relative z-50 -mx-2 flex w-4 shrink-0");
    expect(chrome).toContain("bg-transparent");
    expect(source).not.toContain("bg-border/40 hover:bg-border/80");
    expect(source).not.toContain('"after:w-2"');
    expect(source).not.toContain("<ResizableHandle");
    expect(chrome).toContain("sidebarResizing");
    expect(resize).toContain("const resumeTerminalResizeAfterSidebarDrag");
    expect(resize).toContain("requestAnimationFrame(() => {");
    expect(resize).toContain("setTerminalResizePaused(true);");
    expect(resize).toContain("setTerminalResizePaused(false);");
  });

  it("keeps the workspaces sidebar resizable without a visible divider bar", () => {
    const source = readFileSync(appPath, "utf8");
    const layout = readFileSync(path.join(here, "lib/useAppLayout.ts"), "utf8");
    const resize = readFileSync(path.join(here, "lib/useAppLayoutResize.ts"), "utf8");
    const chrome = readFileSync(path.join(here, "AppChrome.tsx"), "utf8");
    const constants = readFileSync(appConstantsPath, "utf8");

    expect(constants).toContain(
      'export const WORKSPACES_PANEL_WIDTH_STORAGE_KEY = "cmdspace.workspaces.width"',
    );
    expect(constants).toContain("export const WORKSPACES_PANEL_COLLAPSE_WIDTH =");
    expect(layout).toContain("const [workspacesPanelResizing, setWorkspacesPanelResizing]");
    expect(layout).toContain("workspacesPanelResizeStartRef: useRef");
    expect(layout).toContain("readWorkspacesPanelWidth");
    expect(resize).toContain("clampWorkspacesPanelWidth");
    expect(resize).toContain("handleWorkspacesPanelResizeStart");
    expect(resize).toContain("handleWorkspacesPanelResizeMove");
    expect(resize).toContain("handleWorkspacesPanelResizeEnd");
    expect(resize).toContain("handleWorkspacesPanelResizeKeyDown");
    expect(chrome).toContain("Open workspaces panel");
    expect(chrome).toContain("Resize workspaces panel");
    expect(chrome).toContain("-mx-2 flex w-4 shrink-0 cursor-col-resize");
    expect(source).not.toContain("cmdspace-workspaces-panel-width");
  });

  it("defers terminal resize work during animated sidebar toggles", () => {
    const source = [
      readFileSync(appPath, "utf8"),
      readFileSync(chromeActionsPath, "utf8"),
    ].join("\n");
    const constants = readFileSync(appConstantsPath, "utf8");
    const resize = readFileSync(path.join(here, "lib/useAppLayoutResize.ts"), "utf8");

    expect(constants).toContain("export const CHROME_RESIZE_TRANSITION_MS =");
    expect(resize).toContain("const pauseTerminalResizeForChromeTransition");
    expect(resize).toContain("terminalResizeResumeTimerRef");
    expect(resize).toContain("window.setTimeout(() => {");
    expect(resize).toContain("requestAnimationFrame(() => {");
    expect(resize).toContain("!sidebarResizeStartRef.current &&");
    expect(resize).toContain("!workspacesPanelResizeStartRef.current");
    expect(source).toContain("pauseTerminalResizeForChromeTransition();");
    expect(source).toContain("setSidebarOpen((open) => !open);");
    expect(source).toContain("setWorkspacesPanelOpen((open) => !open);");
  });

  it("persists terminal pane layouts with workspace records", () => {
    const appSource = readFileSync(appPath, "utf8");
    const controllerSource = [
      readFileSync(path.join(here, "lib/useWorkspaceController.ts"), "utf8"),
      readFileSync(path.join(here, "lib/useWorkspaceHydration.ts"), "utf8"),
      readFileSync(workspaceRecordActionsPath, "utf8"),
      readFileSync(path.join(here, "lib/workspaceControllerTypes.ts"), "utf8"),
    ].join("\n");
    const persistenceSource = readFileSync(
      path.join(here, "lib/useWorkspacePersistence.ts"),
      "utf8",
    );
    const layoutSource = readFileSync(
      path.join(here, "lib/workspaceLayoutPersistence.ts"),
      "utf8",
    );
    const paneActionsSource = readFileSync(
      path.join(here, "lib/useAppPaneActions.ts"),
      "utf8",
    );
    expect(controllerSource).toContain("paneLayout: string | null;");
    expect(controllerSource).toContain("paneLayout: workspace.paneLayout ?? null");
    expect(appSource).toContain("useWorkspacePersistence<WorkspaceRecord>({");
    expect(appSource).toContain(
      'persistWorkspace: (workspace) => invoke("db_save_workspace", { workspace })',
    );
    expect(appSource).toContain("onPaneTreeChange: handleTerminalPaneTreeChange");
    expect(paneActionsSource).toContain(
      "const appended = splitActivePane(activeId, direction);",
    );
    expect(paneActionsSource).toContain(
      "persistSplitPaneTree(activeId, appended.paneTree);",
    );
    expect(persistenceSource).toContain(
      "dependencies.setTerminalPaneTree(tabId, paneTree);",
    );
    expect(layoutSource).toContain(
      "paneLayout: JSON.stringify(input.paneTree)",
    );
    expect(persistenceSource).toContain(
      "Failed to save terminal pane layout to SQLite",
    );
  });

  it("persists and restores the complete canvas workspace diagram", () => {
    const appSource = readFileSync(appPath, "utf8");
    const selectionSource = readFileSync(
      path.join(here, "lib/useWorkspaceSelection.ts"),
      "utf8",
    ) + readFileSync(
      path.join(here, "lib/workspaceSelectionRestoration.ts"),
      "utf8",
    );
    const selectionControllerSource = readFileSync(
      path.join(here, "lib/useWorkspaceSelectionController.ts"),
      "utf8",
    );
    const persistenceSource = readFileSync(
      path.join(here, "lib/useWorkspacePersistence.ts"),
      "utf8",
    );
    const layoutSource = readFileSync(
      path.join(here, "lib/workspaceLayoutPersistence.ts"),
      "utf8",
    );
    const creationSource = readFileSync(
      path.join(here, "lib/workspaceCreationModel.ts"),
      "utf8",
    );

    expect(selectionControllerSource).toContain("useWorkspaceSelection({");
    expect(appSource).toContain("buildCanvasWorkspaceDiagram,");
    expect(creationSource).toContain("buildCanvasWorkspaceDiagram");
    expect(selectionSource).toContain(
      "parseCanvasWorkspaceDiagram(workspace.paneLayout)",
    );
    expect(selectionSource).toContain("persistedDiagram");
    expect(layoutSource).toContain(
      "const paneLayout = serializeCanvasWorkspaceDiagram(input.diagram);",
    );
    expect(layoutSource).toContain(
      "workspace.count === count && workspace.paneLayout === paneLayout",
    );
    expect(persistenceSource).toContain(
      'Failed to save canvas workspace diagram to SQLite',
    );
    expect(selectionControllerSource).toContain(
      'console.error("Failed to load canvas workspace panes from SQLite:", error),',
    );
  });

  it("deletes an active workspace through a single confirmed action", () => {
    const source = [
      readFileSync(appPath, "utf8"),
      readFileSync(workspaceDeleteDialogPath, "utf8"),
      readFileSync(workspaceDeletionPath, "utf8"),
      readFileSync(workspaceDeleteConfirmationPath, "utf8"),
    ].join("\n");
    const controller = readFileSync(path.join(here, "lib/useWorkspaceController.ts"), "utf8");
    const constants = readFileSync(appConstantsPath, "utf8");

    expect(source).toContain("WORKSPACE_DELETE_CONFIRM_STORAGE_KEY");
    expect(constants).toContain("export const WORKSPACE_DELETE_CONFIRM_STORAGE_KEY");
    expect(source).toContain("pendingDeleteWorkspaceId");
    expect(source).toContain("skipWorkspaceDeleteConfirm");
    expect(source).toContain("workspaceDeleteDoNotAskAgain");
    expect(source).toContain("const deleteWorkspace = useWorkspaceDeletion");
    expect(controller).toContain("for (const tabId of tabIds");
    expect(controller).toContain('invoke("db_delete_workspace", { id: workspaceId })');
    expect(source).toContain("setPendingWorkspaceId(workspaceId);");
    expect(source).not.toContain("handleClose(workspace.tabId);");
    expect(source).toContain("Delete02Icon");
    expect(source).toContain("This will permanently remove");
    expect(source).toContain("backdrop-blur-[2px]");
    expect(source).toContain("Delete workspace?");
    expect(source).toContain("Do not ask again");
    expect(source).toContain("bg-destructive px-4 text-white");
  });

  it("replaces the final workspace tab with an unowned shell before deleting it", () => {
    const source = [
      readFileSync(appPath, "utf8"),
      readFileSync(workspaceDeletionPath, "utf8"),
    ].join("\n");
    const controller = readFileSync(path.join(here, "lib/useWorkspaceController.ts"), "utf8");

    expect(source).toContain("const tabIds = new Set(");
    expect(source).toContain("wouldLeaveNoTabs:");
    expect(source).toContain("fallbackCwd,");
    expect(controller).toContain("if (wouldLeaveNoTabs) resetWorkspace(fallbackCwd);");
  });

  it("persists workspace accent colors for the workspace list", () => {
    const source = [
      readFileSync(appPath, "utf8"),
      readFileSync(path.join(here, "lib/workspaceCreationModel.ts"), "utf8"),
      readFileSync(workspaceSetupActionsPath, "utf8"),
    ].join("\n");
    const surface = readFileSync(path.join(here, "WorkspaceSurface.tsx"), "utf8");
    const controller = [
      readFileSync(path.join(here, "lib/useWorkspaceController.ts"), "utf8"),
      readFileSync(path.join(here, "lib/useWorkspaceHydration.ts"), "utf8"),
      readFileSync(workspaceRecordActionsPath, "utf8"),
    ].join("\n");

    expect(controller).toContain("accentColor?: string | null");
    expect(source).toContain("WORKSPACE_ACCENT_COLORS");
    expect(controller).toContain("normalizeWorkspaceAccentColor");
    expect(controller).toContain("workspaceAccentForIndex(index)");
    expect(source).toContain("requestedColor?: string");
    expect(controller).toContain("normalizeWorkspaceAccentColor(");
    expect(source).toContain("requestedColor,");
    expect(source).toContain("workspaceAccentForIndex(workspaces.length)");
    expect(source).toContain("handleChangeWorkspaceColor");
    expect(controller).toContain("Failed to save workspace color to SQLite");
    expect(source).toContain("onChangeWorkspaceColor={handleChangeWorkspaceColor}");
    expect(source).toContain("activeWorkspaceAccentColor");
    expect(surface).toContain("focusAccentColor={activeWorkspaceAccentColor}");
  });

  it("collapses the right sidebar when resizing past the close threshold", () => {
    const source = readFileSync(appPath, "utf8");
    const constants = readFileSync(appConstantsPath, "utf8");
    const resize = readFileSync(path.join(here, "lib/useAppLayoutResize.ts"), "utf8");

    expect(constants).toContain("export const SIDEBAR_COLLAPSE_WIDTH =");
    expect(resize).toContain("const collapseSidebarFromResize = useCallback");
    expect(resize).toContain("setSidebarOpen(false);");
    expect(resize).toContain("nextWidth <= SIDEBAR_COLLAPSE_WIDTH");
    expect(resize).toContain("collapseSidebarFromResize();");
    expect(resize).toContain(
      "requestAnimationFrame(() => setSidebarResizing(false));",
    );
    expect(source).not.toContain("setSidebarWidth(0)");
  });

  it("keeps app shell constants out of the main component file", () => {
    const source = readFileSync(appPath, "utf8");
    const constants = readFileSync(appConstantsPath, "utf8");

    expect(constants).toContain("export const SIDEBAR_DEFAULT_WIDTH = 320");
    expect(constants).toContain("export const WORKSPACES_PANEL_COMPACT_WIDTH = 152");
    expect(constants).toContain("export const WORKSPACE_LIMIT = 99");
    expect(source).not.toContain("const SIDEBAR_DEFAULT_WIDTH =");
    expect(source).not.toContain("const WORKSPACES_PANEL_COMPACT_WIDTH =");
    expect(source).not.toContain("const WORKSPACE_LIMIT =");
  });

  it("keeps a right-edge drag handle available to reopen the collapsed sidebar", () => {
    const source = readFileSync(appPath, "utf8");
    const layout = readFileSync(path.join(here, "lib/useAppLayout.ts"), "utf8");
    const resize = readFileSync(path.join(here, "lib/useAppLayoutResize.ts"), "utf8");
    const chrome = readFileSync(path.join(here, "AppChrome.tsx"), "utf8");

    expect(layout).toContain("open: boolean;");
    expect(layout).toContain("sidebarResizeStartRef");
    expect(layout).toContain("workspacesPanelResizeStartRef");
    expect(source).not.toContain("if (!sidebarOpen) return;");
    expect(resize).toContain("if (!start.open) {");
    expect(resize).toContain("setSidebarOpen(true);");
    expect(chrome).toContain("Resize right sidebar");
    expect(chrome).toContain("Open right sidebar");
    expect(chrome).toContain('"relative z-50 -mx-2 flex w-4 shrink-0 cursor-col-resize touch-none select-none bg-transparent');
  });

  it("keeps the right sidebar content mounted across toggle cycles", () => {
    const source = readFileSync(path.join(here, "AppChrome.tsx"), "utf8");
    const appSource = readFileSync(appPath, "utf8");
    const sidebarSource = readFileSync(path.join(here, "AppSidebar.tsx"), "utf8");
    const sidebarAside = source.match(
      /<aside[\s\S]*?style=\{\{ width: sidebarOpen \? sidebarWidth : 0 \}\}[\s\S]*?<\/aside>/,
    )?.[0];

    expect(sidebarAside).toBeDefined();
    expect(sidebarAside).not.toContain("{sidebarOpen ? (");
    expect(sidebarAside).toContain("aria-hidden={!sidebarOpen}");
    expect(sidebarAside).toContain('!sidebarOpen && "pointer-events-none"');
    expect(sidebarAside).toContain("style={{ width: sidebarWidth }}");
    expect(appSource).toContain("const sidebar = (");
    expect(sidebarSource).toContain("SidebarBrowserPane");
    expect(appSource).toContain("resizing: sidebarResizing");
  });

  it("keeps the right sidebar free of helper chat surfaces", () => {
    const source = readFileSync(appPath, "utf8");

    expect(source).not.toContain("AiSidebarHelper");
    expect(source).not.toContain('sidebarView === "helper"');
    expect(source).not.toContain("AgentRunBridge");
    expect(source).not.toContain("AiMiniWindow");
  });

  it("keeps both sidebars free of visible edge borders", () => {
    const appSource = readFileSync(appPath, "utf8");
    const panelSource = readFileSync(
      path.join(here, "../modules/workspaces/WorkspacesPanel.tsx"),
      "utf8",
    );

    expect(appSource).not.toContain("border-l border-border/60 bg-card");
    expect(panelSource).not.toContain("border-r border-border/60");
  });
});

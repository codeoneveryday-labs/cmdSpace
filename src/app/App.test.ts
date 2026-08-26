import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const appPath = path.join(here, "App.tsx");
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

    expect(source).toContain("handleSwitchTerminalAgent");
    expect(source).toContain("setLeafLaunchCommand(leafId, command)");
    expect(source).toContain("replaceSessionCommand(leafId, cwd, command)");
    expect(source).toContain('invoke("db_save_pane"');
  });

  it("publishes manual CLI-agent launches back into the live pane tree", () => {
    const source = readFileSync(appPath, "utf8");
    const matches = source.match(/setLeafLaunchCommand\(leafId, command\);/g) ?? [];

    expect(source).toContain("const isCliAgent = detectCliAgent(command) !== null;");
    expect(source).toContain("if (isCliAgent) {");
    expect(matches).toHaveLength(2);
  });

  it("persists agent chat session identity for every CLI provider instead of Codex only", () => {
    const source = readFileSync(appPath, "utf8");

    expect(source).not.toContain('if (provider !== "codex") return;');
    expect(source).toContain("nativeSessionId={tab.nativeSessionId}");
  });

  it("auto-activates the first workspace only once so standalone tabs remain selectable", () => {
    const source = readFileSync(appPath, "utf8");

    expect(source).toContain("initialWorkspaceActivationHandledRef.current = true");
    expect(source).toContain("pendingBootstrapCloseRef.current = true");
    expect(source).toContain("shouldSuppressBootstrapShell({");
    expect(source).toContain(
      "pendingBootstrapClose: pendingBootstrapCloseRef.current",
    );
    expect(source).not.toContain(
      "initialWorkspaceActivationHandledRef.current = false",
    );
  });

  it("replaces the bottom AI composer with a terminal drawer", () => {
    const source = readFileSync(appPath, "utf8");

    expect(source).toContain("BottomTerminalDrawer");
    expect(source).toContain("bottomTerminalOpen");
    expect(source).toContain('"terminal.bottom": toggleBottomTerminal');
    expect(source).not.toContain("data-ai-input-bar");
    expect(source).not.toContain("<AiInputBar />");
    expect(source).not.toContain("<AiInputBarConnect");
  });

  it("uses the status-bar shortcut to open the terminal drawer without AI chat controls", () => {
    const appSource = readFileSync(appPath, "utf8");
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

  it("opens the bottom terminal from the active workspace folder", () => {
    const source = readFileSync(appPath, "utf8");

    expect(source).toContain("const activeWorkspaceFolder =");
    expect(source).toContain("activeWorkspaceFolder ??");
    expect(source).toContain("workspace.agentTabIds?.includes(activeId)");
  });

  it("refreshes provider keys when the main window becomes active again", () => {
    const source = readFileSync(appPath, "utf8");

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
    const source = readFileSync(appPath, "utf8");

    expect(source).toContain(
      "const [sidebarOpen, setSidebarOpen] = useState(true);",
    );
    expect(source).toContain(
      "const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);",
    );
    expect(source).toContain("setSidebarOpen((open) => !open);");
    expect(source).toContain("style={{ width: sidebarOpen ? sidebarWidth : 0 }}");
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
    const source = readFileSync(appPath, "utf8");

    expect(source).toContain("const canvasFocused = !workspacesPanelOpen && !sidebarOpen;");
    expect(source).toContain("const toggleCanvasFocus = useCallback(() => {");
    expect(source).toContain("setWorkspacesPanelOpen(false);");
    expect(source).toContain("setSidebarOpen(false);");
    expect(source).toContain("setWorkspacesPanelOpen(true);");
    expect(source).toContain("setSidebarOpen(true);");
  });

  it("keeps sidebar resizing smooth and away from the browser URL field", () => {
    const source = readFileSync(appPath, "utf8");

    expect(source).toContain(
      "const [sidebarResizing, setSidebarResizing] = useState(false);",
    );
    expect(source).toContain("const sidebarResizeStartRef = useRef");
    expect(source).toContain("onPointerDown={handleSidebarResizeStart}");
    expect(source).toContain(
      'window.addEventListener("pointermove", handleSidebarResizeMove);',
    );
    expect(source).toContain("handleSidebarResizeEnd");
    expect(source).toContain('role="separator"');
    expect(source).toContain("relative z-50 -mx-2 flex w-4 shrink-0");
    expect(source).toContain("bg-transparent");
    expect(source).not.toContain("bg-border/40 hover:bg-border/80");
    expect(source).not.toContain('"after:w-2"');
    expect(source).not.toContain("<ResizableHandle");
    expect(source).toContain("resizing={sidebarResizing}");
    expect(source).toContain("setTerminalResizePaused(true);");
    expect(source).toContain("setTerminalResizePaused(false);");
    expect(source).toContain("const resumeTerminalResizeAfterSidebarDrag");
    expect(source).toContain("requestAnimationFrame(() => {");
  });

  it("keeps the workspaces sidebar resizable without a visible divider bar", () => {
    const source = readFileSync(appPath, "utf8");
    const constants = readFileSync(appConstantsPath, "utf8");

    expect(constants).toContain(
      'export const WORKSPACES_PANEL_WIDTH_STORAGE_KEY = "cmdspace.workspaces.width"',
    );
    expect(constants).toContain("export const WORKSPACES_PANEL_COLLAPSE_WIDTH =");
    expect(source).toContain("const [workspacesPanelResizing, setWorkspacesPanelResizing]");
    expect(source).toContain("const workspacesPanelResizeStartRef = useRef");
    expect(source).toContain("readWorkspacesPanelWidth");
    expect(source).toContain("clampWorkspacesPanelWidth");
    expect(source).toContain("handleWorkspacesPanelResizeStart");
    expect(source).toContain("handleWorkspacesPanelResizeMove");
    expect(source).toContain("handleWorkspacesPanelResizeEnd");
    expect(source).toContain("handleWorkspacesPanelResizeKeyDown");
    expect(source).toContain("Open workspaces panel");
    expect(source).toContain("Resize workspaces panel");
    expect(source).toContain("-mx-2 flex w-4 shrink-0 cursor-col-resize");
    expect(source).not.toContain("cmdspace-workspaces-panel-width");
  });

  it("defers terminal resize work during animated sidebar toggles", () => {
    const source = readFileSync(appPath, "utf8");
    const constants = readFileSync(appConstantsPath, "utf8");

    expect(constants).toContain("export const CHROME_RESIZE_TRANSITION_MS =");
    expect(source).toContain("const pauseTerminalResizeForChromeTransition");
    expect(source).toContain("terminalResizeResumeTimerRef");
    expect(source).toContain("window.setTimeout(() => {");
    expect(source).toContain("requestAnimationFrame(() => {");
    expect(source).toContain("!sidebarResizeStartRef.current &&");
    expect(source).toContain("!workspacesPanelResizeStartRef.current");
    expect(source).toContain("pauseTerminalResizeForChromeTransition();");
    expect(source).toContain("setSidebarOpen((open) => !open);");
    expect(source).toContain("setWorkspacesPanelOpen((open) => !open);");
  });

  it("persists terminal pane layouts with workspace records", () => {
    const appSource = readFileSync(appPath, "utf8");
    const persistenceSource = readFileSync(
      path.join(here, "lib/useWorkspacePersistence.ts"),
      "utf8",
    );
    const layoutSource = readFileSync(
      path.join(here, "lib/workspaceLayoutPersistence.ts"),
      "utf8",
    );

    expect(appSource).toContain("paneLayout: string | null;");
    expect(appSource).toContain("paneLayout: w.paneLayout ?? null");
    expect(appSource).toContain("useWorkspacePersistence<WorkspaceRecord>({");
    expect(appSource).toContain(
      'persistWorkspace: (workspace) => invoke("db_save_workspace", { workspace })',
    );
    expect(appSource).toContain("onPaneTreeChange={handleTerminalPaneTreeChange}");
    expect(appSource).toContain("const appended = splitActivePane(activeId, dir);");
    expect(appSource).toContain(
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
    );
    const persistenceSource = readFileSync(
      path.join(here, "lib/useWorkspacePersistence.ts"),
      "utf8",
    );
    const layoutSource = readFileSync(
      path.join(here, "lib/workspaceLayoutPersistence.ts"),
      "utf8",
    );

    expect(appSource).toContain("useWorkspaceSelection({");
    expect(appSource).toContain(
      "buildCanvasWorkspaceDiagram: canvasWorkspaceDiagram",
    );
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
    expect(appSource).toContain(
      'console.error("Failed to load canvas workspace panes from SQLite:", err);',
    );
  });

  it("deletes an active workspace through a single confirmed action", () => {
    const source = readFileSync(appPath, "utf8");
    const constants = readFileSync(appConstantsPath, "utf8");

    expect(source).toContain("WORKSPACE_DELETE_CONFIRM_STORAGE_KEY");
    expect(constants).toContain("export const WORKSPACE_DELETE_CONFIRM_STORAGE_KEY");
    expect(source).toContain("pendingDeleteWorkspaceId");
    expect(source).toContain("skipWorkspaceDeleteConfirm");
    expect(source).toContain("workspaceDeleteDoNotAskAgain");
    expect(source).toContain("const deleteWorkspace = useCallback");
    expect(source).toContain("for (const tabId of workspaceTabIds)");
    expect(source).toContain('invoke("db_delete_workspace", { id: workspaceId })');
    expect(source).toContain("setPendingDeleteWorkspaceId(workspaceId);");
    expect(source).not.toContain("handleClose(workspace.tabId);");
    expect(source).toContain("Delete02Icon");
    expect(source).toContain("This will permanently remove");
    expect(source).toContain("backdrop-blur-[2px]");
    expect(source).toContain("Delete workspace?");
    expect(source).toContain("Do not ask again");
    expect(source).toContain("bg-destructive px-4 text-white");
  });

  it("replaces the final workspace tab with an unowned shell before deleting it", () => {
    const source = readFileSync(appPath, "utf8");

    expect(source).toContain("const workspaceTabIds = new Set(");
    expect(source).toContain("const wouldLeaveNoTabs =");
    expect(source).toContain("resetWorkspace(launchCwd ?? home ?? undefined);");
    expect(source).toContain("cannot leave a terminal tab without a workspace owner");
  });

  it("persists workspace accent colors for the workspace list", () => {
    const source = readFileSync(appPath, "utf8");

    expect(source).toContain("accentColor?: string | null");
    expect(source).toContain("WORKSPACE_ACCENT_COLORS");
    expect(source).toContain("normalizeWorkspaceAccentColor");
    expect(source).toContain("workspaceAccentForIndex(index)");
    expect(source).toContain("requestedColor?: string");
    expect(source).toContain("normalizeWorkspaceAccentColor(");
    expect(source).toContain("requestedColor,");
    expect(source).toContain("workspaceAccentForIndex(workspaces.length)");
    expect(source).toContain("handleChangeWorkspaceColor");
    expect(source).toContain("Failed to save workspace color to SQLite");
    expect(source).toContain("onChangeWorkspaceColor={handleChangeWorkspaceColor}");
    expect(source).toContain("activeWorkspaceAccentColor");
    expect(source).toContain("focusAccentColor={activeWorkspaceAccentColor}");
  });

  it("collapses the right sidebar when resizing past the close threshold", () => {
    const source = readFileSync(appPath, "utf8");
    const constants = readFileSync(appConstantsPath, "utf8");

    expect(constants).toContain("export const SIDEBAR_COLLAPSE_WIDTH =");
    expect(source).toContain("const collapseSidebarFromResize = useCallback");
    expect(source).toContain("setSidebarOpen(false);");
    expect(source).toContain("nextWidth <= SIDEBAR_COLLAPSE_WIDTH");
    expect(source).toContain("collapseSidebarFromResize();");
    expect(source).toContain(
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

    expect(source).toContain("open: boolean;");
    expect(source).toContain("width: sidebarOpen ? sidebarWidthRef.current : 0");
    expect(source).toContain("open: sidebarOpen");
    expect(source).not.toContain("if (!sidebarOpen) return;");
    expect(source).toContain("const reopeningSidebar = !start.open;");
    expect(source).toContain("if (reopeningSidebar) {");
    expect(source).toContain("setSidebarOpen(true);");
    expect(source).toContain("Resize right sidebar");
    expect(source).toContain("Open right sidebar");
    expect(source).toContain('"relative z-50 -mx-2 flex w-4 shrink-0 cursor-col-resize touch-none select-none bg-transparent');
  });

  it("keeps the right sidebar content mounted across toggle cycles", () => {
    const source = readFileSync(appPath, "utf8");
    const sidebarAside = source.match(
      /<aside[\s\S]*?style=\{\{ width: sidebarOpen \? sidebarWidth : 0 \}\}[\s\S]*?<\/aside>/,
    )?.[0];

    expect(sidebarAside).toBeDefined();
    expect(sidebarAside).not.toContain("{sidebarOpen ? (");
    expect(sidebarAside).toContain("aria-hidden={!sidebarOpen}");
    expect(sidebarAside).toContain('!sidebarOpen && "pointer-events-none"');
    expect(sidebarAside).toContain("style={{ width: sidebarWidth }}");
    expect(sidebarAside).toContain("SidebarBrowserPane");
    expect(sidebarAside).toContain("resizing={sidebarResizing}");
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

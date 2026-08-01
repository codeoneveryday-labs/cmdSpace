import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const appPath = path.join(here, "App.tsx");
const appConstantsPath = path.join(here, "constants.ts");
const shortcutsPath = path.join(here, "../modules/shortcuts/shortcuts.ts");

describe("App sidebar toggle", () => {
  it("ships a prompt engineer role for prompt-first requests", () => {
    const source = readFileSync(
      path.join(here, "../modules/ai/lib/agents.ts"),
      "utf8",
    );

    expect(source).toContain('id: "builtin:prompt-engineer"');
    expect(source).toContain('name: "Prompt Engineer"');
    expect(source).toContain("prompt engineer");
    expect(source).toContain("do not write the implementation");
    expect(source).toContain("dispatch_to_terminals");
    expect(source).toContain("Task, Context, Requirements");
    expect(source).toContain("focused terminal pane");
    expect(source).toContain("do not create a markdown file");
    expect(source).toContain("English");
  });

  it("does not ship Architect as a built-in role", () => {
    const source = readFileSync(
      path.join(here, "../modules/ai/lib/agents.ts"),
      "utf8",
    );

    expect(source).toContain('id: "builtin:prompt-engineer"');
    expect(source).toContain('DEFAULT_AGENT_ID = "builtin:prompt-engineer"');
    expect(source).not.toContain('id: "builtin:architect"');
    expect(source).not.toContain('name: "Architect"');
    expect(source).not.toContain('id: "builtin:coder"');
    expect(source).not.toContain('id: "builtin:reviewer"');
    expect(source).not.toContain('id: "builtin:security"');
    expect(source).not.toContain('id: "builtin:designer"');
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

  it("uses the status-bar shortcut to open the terminal drawer, not the AI panel", () => {
    const appSource = readFileSync(appPath, "utf8");
    const statusBarSource = readFileSync(
      path.join(here, "../modules/statusbar/StatusBar.tsx"),
      "utf8",
    );
    const aiControlsSource = readFileSync(
      path.join(here, "../modules/ai/components/AiStatusBarControls.tsx"),
      "utf8",
    );

    expect(statusBarSource).toContain('onToggleTerminal: () => void;');
    expect(statusBarSource).toContain('onClick={onToggleTerminal}');
    expect(statusBarSource).toContain('title="Open terminal"');
    expect(statusBarSource).toContain("Open terminal");
    expect(statusBarSource).not.toContain("Open AI agent");
    expect(aiControlsSource).not.toContain("Open AI agent");
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
    expect(source).toContain("workspace.tabId === activeId || workspace.canvasTabId === activeId");
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
    expect(source).toContain("relative z-50 flex w-2 shrink-0");
    expect(source).toContain("after:w-full");
    expect(source).toContain("bg-border/40 hover:bg-border/80");
    expect(source).toContain("hover:bg-border/80");
    expect(source).not.toContain('"after:w-2"');
    expect(source).not.toContain("<ResizableHandle");
    expect(source).toContain("resizing={sidebarResizing}");
    expect(source).toContain("setTerminalResizePaused(true);");
    expect(source).toContain("setTerminalResizePaused(false);");
    expect(source).toContain("const resumeTerminalResizeAfterSidebarDrag");
    expect(source).toContain("requestAnimationFrame(() => {");
  });

  it("defers terminal resize work during animated sidebar toggles", () => {
    const source = readFileSync(appPath, "utf8");
    const constants = readFileSync(appConstantsPath, "utf8");

    expect(constants).toContain("export const CHROME_RESIZE_TRANSITION_MS =");
    expect(source).toContain("const pauseTerminalResizeForChromeTransition");
    expect(source).toContain("terminalResizeResumeTimerRef");
    expect(source).toContain("window.setTimeout(() => {");
    expect(source).toContain("requestAnimationFrame(() => {");
    expect(source).toContain("if (!sidebarResizeStartRef.current) {");
    expect(source).toContain("pauseTerminalResizeForChromeTransition();");
    expect(source).toContain("setSidebarOpen((open) => !open);");
    expect(source).toContain("setWorkspacesPanelOpen((open) => !open);");
  });

  it("persists terminal pane layouts with workspace records", () => {
    const source = readFileSync(appPath, "utf8");

    expect(source).toContain("paneLayout: string | null;");
    expect(source).toContain("paneLayout: w.paneLayout ?? null");
    expect(source).toContain("setTerminalPaneTree(tabId, paneTree);");
    expect(source).toContain("paneLayout: JSON.stringify(paneTree)");
    expect(source).toContain("Failed to save terminal pane layout to SQLite");
    expect(source).toContain("onPaneTreeChange={handleTerminalPaneTreeChange}");
  });

  it("persists and restores the complete canvas workspace diagram", () => {
    const source = readFileSync(appPath, "utf8");

    expect(source).toContain("serializeCanvasWorkspaceDiagram(diagram)");
    expect(source).toMatch(
      /parseCanvasWorkspaceDiagram\(\s*workspace\.paneLayout,\s*\)/,
    );
    expect(source).toContain("paneLayout: serializedDiagram");
    expect(source).toContain("persistedDiagram");
    expect(source).toContain(
      'Failed to save canvas workspace diagram to SQLite',
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
    expect(source).toContain("disposeTab(workspace.tabId);");
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
    expect(source).toContain("bg-transparent hover:bg-border/60");
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

  it("mounts the AI helper chat in the right sidebar helper tab", () => {
    const source = readFileSync(appPath, "utf8");

    expect(source).toContain("AiSidebarHelper");
    expect(source).toContain('sidebarView === "helper"');
    expect(source).toContain("hasComposer={hasComposer}");
    expect(source).toContain("onConnectProvider={() =>");
    expect(source).toContain('void openSettingsWindow("models")');
    expect(source).not.toContain(
      '<div className="text-sm font-medium text-foreground">\n                            Helper\n                          </div>',
    );
  });

  it("keeps helper sidebar chat from opening the mini popup chat", () => {
    const helperPath = path.join(
      here,
      "../modules/ai/components/AiSidebarHelper.tsx",
    );
    const helperSource = readFileSync(helperPath, "utf8");

    expect(helperSource).toContain("openMiniOnSubmit={false}");
    expect(helperSource).toContain("showAgentSwitcher={false}");
  });

  it("gives the helper sidebar a composed empty state and visible send control", () => {
    const helperPath = path.join(
      here,
      "../modules/ai/components/AiSidebarHelper.tsx",
    );
    const inputPath = path.join(
      here,
      "../modules/ai/components/AiInputBar.tsx",
    );
    const helperSource = readFileSync(helperPath, "utf8");
    const inputSource = readFileSync(inputPath, "utf8");

    expect(helperSource).toContain("HelperEmptyState");
    expect(helperSource).toContain("Ask about this terminal");
    expect(helperSource).toContain("Fix the last error");
    expect(helperSource).toContain("Draft a command");
    expect(inputSource).toContain('aria-label={isBusy ? "Stop response" : "Send message"}');
    expect(inputSource).toContain("ArrowUpIcon");
    expect(inputSource).toContain("StopCircleIcon");
    expect(inputSource).toContain('variant={isBusy ? "destructive" : "default"}');
    expect(inputSource).toContain("rounded-xl border border-border/70 bg-background");
  });
});

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const sourcePath = path.join(here, "CanvasTerminalNode.tsx");
const globalsPath = path.join(here, "../../styles/globals.css");

describe("CanvasTerminalNode", () => {
  it("owns an isolated PTY lifecycle instead of the shared terminal pane session", () => {
    expect(existsSync(sourcePath)).toBe(true);
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("type PtySession");
    expect(source).toContain("openPty(");
    expect(source).toContain("initialCommand?: string");
    expect(source).toContain("initialCwdRef.current,");
    expect(source).toContain("initialCommandRef.current,");
    expect(source).toContain("registerPromptTracker");
    expect(source).toContain("registerCwdHandler");
    expect(source).toContain("createShellIntegrationState");
    expect(source).not.toContain("cwdFromOutput");
    expect(source).toContain("isRejectedCwdError");
    expect(source).toContain("retrying from the workspace default");
    expect(source).toContain("initialCwd");
    expect(source).toContain("session.close");
    expect(source).not.toContain("TerminalPane");
    expect(source).not.toContain("useTerminalSession");
    expect(source).not.toContain("rendererPool");
  });

  it("fits xterm to the floating node and reports CWD changes", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("FitAddon");
    expect(source).toContain("ResizeObserver");
    expect(source).toContain("cornerClassName");
    expect(source).toContain("rounded-none");
    expect(source).toContain("resizePaused");
    expect(source).toContain("if (resizePausedRef.current) return;");
    expect(source).toContain('aria-label="Canvas terminal tabs"');
    expect(source).not.toContain('aria-label="Split vertically"');
    expect(source).not.toContain('aria-label="Split horizontally"');
    expect(source).toContain("onAddTab: () => void");
    expect(source).toContain("onSplitRight: () => void");
    expect(source).toContain('aria-label="Add terminal tab"');
    expect(source).toContain('aria-label="Split terminal right"');
    expect(source).not.toContain("FloatingTerminalOverlay");
    expect(source).toContain("onCwdChange");
    expect(source).toContain("onRequestClose");
    expect(source).toContain("ensureMonoFontsLoaded");
    expect(source).toContain("sharedTerminalOptions");
    expect(source).toContain("terminalRef.current?.focus()");
    expect(source).toContain("attachMacImeBridge");
    expect(source).toContain("shouldUseMacTextInputPath");
    expect(source).toContain("shouldIgnoreMacPrintableTerminalData");
    expect(source).not.toContain("onWriteParsed");
    expect(source).not.toContain("terminal?.refresh(");
    expect(source).toContain("const scheduleFit = () =>");
    expect(source).toContain("resizeObserver = new ResizeObserver(scheduleFit)");
    expect(source).toContain("void session.resize(terminal.cols, terminal.rows);");
    expect(source).toContain("cmdspace-canvas-terminal-viewport");
    expect(source).toContain("min-h-0 min-w-0 flex-1 overflow-hidden");
    expect(source).not.toContain("transformOrigin: \"top left\"");
  });

  it("keeps a draggable vertical scrollbar available on canvas terminals", () => {
    const styles = readFileSync(globalsPath, "utf8");

    expect(styles).toContain(
      ".cmdspace-canvas-terminal-viewport .xterm .scrollbar.vertical",
    );
    expect(styles).toContain(
      ".cmdspace-canvas-terminal-viewport .xterm .xterm-viewport",
    );
    expect(styles).toContain("overflow-y: scroll !important;");
  });

  it("keeps the canvas terminal header free of folder and branch controls", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toContain("TerminalNavigationControls");
    expect(source).not.toContain("onChangeDirectory={changeDirectory}");
    expect(source).not.toContain("write(`cd ${shellQuote(path)}\\r`)");
  });

  it("copies a selected terminal range with the platform shortcut or copy-on-select", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("function isTerminalCopy");
    expect(source).toContain("terminal?.hasSelection()");
    expect(source).toContain("terminal.onSelectionChange");
    expect(source).toContain("terminalCopyOnSelection");
    expect(source).toContain("navigator.clipboard.writeText(selection)");
    expect(source).toContain('let lastAutoCopiedSelection = "";');
    expect(source).toContain("if (selection === lastAutoCopiedSelection) return;");
    expect(source).toContain("terminal?.clearSelection()");
  });

  it("routes clipboard paste through one PTY write instead of both xterm and the macOS IME bridge", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("function isTerminalPaste");
    expect(source).toContain("navigator.clipboard\n              .readText()");
    expect(source).toContain("trackPromptInput(normalized)");
    expect(source).toContain("void sessionRef.current?.write(normalized)");
    expect(source).toContain("if (isTerminalPaste(event))");
    // C1 normalization must be applied before the PTY write on macOS WebKit
    expect(source).toContain("normalizeMacTerminalInput(text)");
    expect(source).toContain("IS_MAC_TEXT_INPUT_PLATFORM");
  });

  it("keeps copy-on-select silent instead of rendering a copy action", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).not.toContain("setSelectedText");
    expect(source).not.toContain('aria-label="Copy selected terminal text"');
    expect(source).toContain("terminalCopyOnSelection");
		expect(source).toContain("cmdspace-terminal-copy-badge");
		expect(source).toContain('role="status"');
		expect(source).toContain('aria-live="polite"');
		expect(source).toContain('setCopyBadgeVisible(true)');
  });

  it("puts single-terminal group controls into its compact title bar", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("singleTerminalGroup: boolean");
    expect(source).toContain("onToggleTerminalGroupLock");
    expect(source).toContain("onToggleTerminalGroupMaximize");
    expect(source).toContain("onRequestCloseTerminalGroup");
    expect(source).toContain('aria-label="Close terminal group"');
  });

  it("allows Voice to draft into an interactive coding CLI without unblocking busy shell commands", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("isInteractiveCodingAgentCommand,");
    expect(source).toContain("shellStateRef.current.inCommand &&");
    expect(source).toContain("interactiveCodingAgentRef.current");
    expect(source).toContain("trackPromptInput(data)");
  });

  it("shows Canvas-only agent response and completion borders", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("type AgentResponseState = \"idle\" | \"responding\" | \"completed\"");
    expect(source).toContain("setAgentResponseState(\"responding\")");
    expect(source).toContain("setAgentResponseState(\"completed\")");
    expect(source).toContain("setAgentResponseState(\"idle\")");
    expect(source).toContain("cmdspace-canvas-agent-responding");
    expect(source).toContain("cmdspace-canvas-agent-completed");
    expect(source).toContain("rounded-[inherit]");
    expect(source).toContain("shadow-[0_0_18px_rgba(16,185,129,0.55)]");
  });

  it("renders dock tabs without changing the isolated PTY lifecycle", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("stackTabs:");
    expect(source).toContain("visible:");
    expect(source).toContain("onActivateTab:");
    expect(source).toContain("onAddTab");
    expect(source).toContain("onSplitRight");
    expect(source).toContain('role="tablist"');
    expect(source).toContain('role="tab"');
    expect(source).toContain("aria-selected={tab.id === activeTabId}");
    expect(source).toContain("onActivateTab(tab.id)");
    expect(source).toContain("if (visible && !resizePausedRef.current) fitRef.current?.()");
    expect(source).toContain("useEffect(() => {");
    expect(source).toContain("}, []);");
    expect(source).toContain("session.close");
  });

  it("uses Cate-like compact tab chrome instead of a large terminal title", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("h-7 shrink-0");
    expect(source).toContain("text-[11px] font-normal");
    expect(source).toContain("grid size-6 place-items-center");
  });

  it("keeps the terminal-group close action compact until hovered", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("grid size-5 place-items-center rounded-md");
    expect(source).toContain("hover:bg-red-500/[0.08] hover:text-red-500");
  });

  it("gives each terminal tab its own close control", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("onRequestCloseTab: (terminalId: string) => void");
    expect(source).toContain('aria-label={`Close ${tab.label}`}');
    expect(source).toContain("onRequestCloseTab(tab.id)");
    expect(source).not.toContain("onRequestCloseGroup");
    expect(source).toContain('aria-label="Close terminal group"');
  });

  it("lets normal trackpad scrolling reach xterm while preserving Canvas pan and zoom", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("panning: boolean");
    expect(source).toContain("onCanvasPanStart");
    expect(source).toContain("onCanvasPanMove");
    expect(source).toContain("onCanvasPanEnd");
    expect(source).toContain("onCanvasWheel");
  expect(source).toContain("if (!panning) return;");
  expect(source).toContain("onPointerDownCapture");
  expect(source).toContain("onWheelCapture");
  expect(source).toContain(
    "if (!panning && !event.ctrlKey && !event.metaKey) return;",
  );
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const terminalStackPath = path.join(here, "TerminalStack.tsx");
const paneTreePath = path.join(here, "PaneTreeView.tsx");
const terminalPanePath = path.join(here, "TerminalPane.tsx");
const useTerminalSessionPath = path.join(here, "lib/useTerminalSession.ts");
const rendererPoolPath = path.join(here, "lib/rendererPool.ts");
const terminalOptionsPath = path.join(here, "lib/terminalOptions.ts");

describe("TerminalStack lazy renderer restore", () => {
  it("mounts only the active terminal workspace and lazily restores its inactive panes", () => {
    const source = readFileSync(terminalStackPath, "utf8");

    expect(source).toContain('import { usePaneHydration } from "./lib/usePaneHydration";');
    expect(source).toContain("usePaneHydration({");
    expect(source).toContain(
      "const activeTerminal = terminals.find((t) => t.id === activeId) ?? null;",
    );
    expect(source).not.toContain("terminals.map((t) => {");
    expect(source).not.toContain("requestIdleCallback");
    expect(source).not.toContain("hydratedLeafIds.has(leafId)");
    expect(source).toContain("onHydrateLeaf={hydrateLeaf}");
  });

  it("keeps inactive panes as lightweight shells until their terminal renderer is hydrated", () => {
    const source = readFileSync(paneTreePath, "utf8");

    expect(source).toContain("isLeafHydrated: (leafId: number) => boolean;");
    expect(source).toContain("onHydrateLeaf: (leafId: number) => void;");
    expect(source).toContain("const hydrated = isLeafHydrated(node.id);");
    expect(source).toContain("{hydrated ? (");
    expect(source).toContain("<TerminalPane");
  });

  it("marks detached terminal sessions invisible so hidden panes are poor eviction candidates", () => {
    const source = readFileSync(useTerminalSessionPath, "utf8");

    expect(source).toContain("s.visibleNow = false;");
    expect(source).toContain("s.focusedNow = false;");
  });

  it("waits for the first shell prompt before sending an initial command", () => {
    const source = readFileSync(useTerminalSessionPath, "utf8");

    expect(source).toContain("function flushInitialCommand");
    expect(source).toContain('s.pty.write(command + "\\r")');
    expect(source).not.toContain('s.pty.write(command + "\\n")');
    expect(source).toContain("scheduleInitialCommandFallback");
    expect(source).toContain("registerPromptTracker(term, shellState, () =>");
    expect(source).toContain("s.callbacks.onCommand?.(command);");
    expect(source).not.toContain(
      "if (s.initialCommand) {\n          pty.write",
    );
  });

  it("allows Voice to write into an active coding CLI but not a normal busy shell command", () => {
    const source = readFileSync(useTerminalSessionPath, "utf8");

    expect(source).toContain("interactiveCodingAgent: boolean");
    expect(source).toContain("isInteractiveCodingAgentCommand,");
    expect(source).toContain("s.interactiveCodingAgent = isInteractiveCodingAgentCommand(command);");
    expect(source).toContain("s.shellState?.inCommand && !s.interactiveCodingAgent");
    expect(source).toContain("function trackAgentLaunchInput");
    expect(source).toContain("detectCodingAgentBanner,");
    expect(source).toContain("if (isInteractiveCodingAgentCommand(command))");
    expect(source).toContain("s.callbacks.onCommand?.(command);");
  });

  it("keeps CLI agent chrome when a user starts an agent after pane creation", () => {
    const treeSource = readFileSync(paneTreePath, "utf8");
    const sessionSource = readFileSync(useTerminalSessionPath, "utf8");

    expect(treeSource).toContain("const [detectedAgentCommand, setDetectedAgentCommand]");
    expect(treeSource).toContain("useAgentCliCommand");
    expect(treeSource).toContain("storedAgentCommand");
    expect(treeSource).toContain("if (detectCliAgent(cmd)) setDetectedAgentCommand(cmd);");
    expect(treeSource).toContain("agentCommand={detectedAgentCommand ?? storedAgentCommand ?? node.lastCommand}");
    expect(sessionSource).toContain("setAgentCliCommand(leafId, initialCommand);");
    expect(sessionSource).toContain("if (detectedAgent) {");
    expect(sessionSource).toContain("setAgentCliCommand(leafId, detectedAgent);");
  });

  it("only runs a persisted pane command when it is an explicit launch command", () => {
    const treeSource = readFileSync(paneTreePath, "utf8");

    expect(treeSource).toContain(
      "initialCommand={node.autoLaunch ? node.lastCommand : undefined}",
    );
  });

  it("tracks coding-agent response output without requiring shell OSC command markers", () => {
    const source = readFileSync(useTerminalSessionPath, "utf8");

    expect(source).toContain(
      "if (s.interactiveCodingAgent && !outputIsUserEcho)",
    );
    expect(source).not.toContain(
      "s.interactiveCodingAgent && s.shellState?.inCommand && !outputIsUserEcho",
    );
  });

  it("keeps terminal split geometry in the same zoom coordinate space as its handles", () => {
    const treeSource = readFileSync(paneTreePath, "utf8");
    const paneSource = readFileSync(terminalPanePath, "utf8");
    const sessionSource = readFileSync(useTerminalSessionPath, "utf8");
    const rendererSource = readFileSync(rendererPoolPath, "utf8");

    expect(treeSource).toContain("groupRef={groupRef}");
    expect(treeSource).toContain("disabled");
    expect(treeSource).toContain("startZoomAwarePaneResize");
    expect(treeSource).toContain(
      "const zoomLevel = usePreferencesStore.getState().zoomLevel || 1;",
    );
    expect(treeSource).toContain(
      "((latestPoint - startPoint) / zoomLevel / groupSize) * 100",
    );
    expect(treeSource).toContain(
      "ownerWindow.requestAnimationFrame(applyLatestPoint)",
    );
    expect(treeSource).toContain("commitSplitLayout(latestLayout);");
    expect(treeSource).toContain("defaultLayout={getDefaultLayout()}");
    expect(treeSource).toContain(
      "onPaneTreeChange({ ...splitNode, children: nextChildren });",
    );
    expect(treeSource).toContain(
      'ownerDocument.addEventListener("pointermove", handlePointerMove);',
    );
    expect(treeSource).toContain(
      'ownerDocument.addEventListener("pointerup", finish);',
    );
    expect(treeSource).toContain("cursor-col-resize");
    expect(treeSource).toContain("cursor-row-resize");
    expect(treeSource).not.toContain("resizeTargetMinimumSize=");
    expect(treeSource).not.toContain("<ResizableHandle disabled");
    expect(treeSource).not.toContain("startPaneResizeDrag");
    expect(treeSource).not.toContain("<ResizableHandle");
    expect(paneSource).toContain("cmdspace-terminal-viewport");
    expect(paneSource).toContain('contentTopPadding && "pt-12"');
    expect(paneSource).not.toContain("px-2 pb-2 pt-12");
    expect(sessionSource).toContain("applyZoomLevel(zoomLevel)");
    const optionsSource = readFileSync(terminalOptionsPath, "utf8");
    expect(optionsSource).toContain("function effectiveTerminalFontSize");
    expect(optionsSource).toContain("fontSize * zoomLevel");
    expect(rendererSource).toContain("cmdspace-terminal-zoom-surface");
    expect(rendererSource).toContain(
      "slot.host.style.width = `${zoomLevel * 100}%`",
    );
    expect(rendererSource).toContain("scale(${1 / zoomLevel})");
    expect(rendererSource).not.toContain("dims.cols * zoomLevel");
    expect(rendererSource).not.toContain("dims.rows * zoomLevel");
  });

  it("persists terminal pane layout changes through the active tab tree", () => {
    const stackSource = readFileSync(terminalStackPath, "utf8");

    expect(stackSource).toContain(
      "onPaneTreeChange: (tabId: number, paneTree: PaneNode) => void;",
    );
    expect(stackSource).toContain(
      "onPaneTreeChange(activeTerminal.id, paneTree)",
    );
  });

  it("uses the active workspace accent color for the focused pane outline", () => {
    const stackSource = readFileSync(terminalStackPath, "utf8");
    const treeSource = readFileSync(paneTreePath, "utf8");

    expect(stackSource).toContain("focusAccentColor: string;");
    expect(stackSource).toContain("focusAccentColor={focusAccentColor}");
    expect(treeSource).toContain("focusAccentColor: string;");
    expect(treeSource).toContain("paneFocusStyle(focusAccentColor)");
    expect(treeSource).toContain("border-2 z-30");
    expect(treeSource).toContain("borderColor: accent");
    expect(treeSource).toContain("boxShadow: `inset 0 0 8px");
    expect(treeSource).not.toContain("border-[#0088ff]");
  });
});

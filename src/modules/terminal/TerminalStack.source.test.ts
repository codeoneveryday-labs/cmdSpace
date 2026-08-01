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

    expect(source).toContain("TERMINAL_LAZY_RESTORE_DELAY_MS");
    expect(source).toContain(
      "const activeTerminal = terminals.find((t) => t.id === activeId) ?? null;",
    );
    expect(source).not.toContain("terminals.map((t) => {");
    expect(source).toContain("requestIdleCallback");
    expect(source).toContain("cancelIdleCallback");
    expect(source).toContain("hydratedLeafIds.has(leafId)");
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
    expect(source).toContain('s.pty.write(s.initialCommand + "\\r")');
    expect(source).not.toContain('s.pty.write(s.initialCommand + "\\n")');
    expect(source).toContain("scheduleInitialCommandFallback");
    expect(source).toContain("registerPromptTracker(term, shellState, () =>");
    expect(source).not.toContain(
      "if (s.initialCommand) {\n          pty.write",
    );
  });

  it("allows Voice to write into an active coding CLI but not a normal busy shell command", () => {
    const source = readFileSync(useTerminalSessionPath, "utf8");

    expect(source).toContain("interactiveCodingAgent: boolean");
    expect(source).toContain("function isInteractiveCodingAgentCommand");
    expect(source).toContain("s.interactiveCodingAgent = isInteractiveCodingAgentCommand(command);");
    expect(source).toContain("s.shellState?.inCommand && !s.interactiveCodingAgent");
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
    expect(paneSource).toContain(
      'className="cmdspace-terminal-viewport h-full w-full overflow-hidden pt-12"',
    );
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
    expect(treeSource).toContain("border-2 z-10");
    expect(treeSource).toContain("borderColor: accent");
    expect(treeSource).toContain("boxShadow: `inset 0 0 8px");
    expect(treeSource).not.toContain("border-[#0088ff]");
  });
});

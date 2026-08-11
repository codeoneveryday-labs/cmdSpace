import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const paneTreePath = path.join(here, "PaneTreeView.tsx");
const terminalStackPath = path.join(here, "TerminalStack.tsx");
const agentCliIconPath = path.join(here, "AgentCliIcon.tsx");

describe("FloatingTerminalOverlay", () => {
  it("keeps the terminal header flush without outer padding or rounding", () => {
    const source = readFileSync(paneTreePath, "utf8");

    expect(source).toContain(
      "absolute inset-x-0 top-0 z-20 flex items-center",
    );
    expect(source).toContain("rounded-none border");
    expect(source).toContain("px-0 py-0");
    expect(source).not.toContain("left-1/2 -translate-x-1/2 z-20");
  });

  it("renders the active-pane outline above the terminal header", () => {
    const source = readFileSync(paneTreePath, "utf8");

    expect(source).toContain("pointer-events-none border-2 z-30");
    expect(source).toContain("top-0 z-20 flex items-center");
  });

  it("shows the coding CLI identity at the start of the pane header", () => {
    const source = readFileSync(paneTreePath, "utf8");
    const iconSource = readFileSync(agentCliIconPath, "utf8");

    expect(source).toContain("detectCliAgent,");
    expect(source).toContain("AgentCliIcon");
    expect(source).toContain(
      "agentCommand={detectedAgentCommand ?? storedAgentCommand ?? node.lastCommand}",
    );
    expect(iconSource).toContain("getAgentBrandIcon");
    expect(iconSource).toContain("<BrandIcon");
    expect(iconSource).toContain('size === "md" ? 14 : 12');
    expect(iconSource).toContain("text-foreground");
    expect(iconSource).not.toContain("AGENT_CLI_ICON_META");
  });

  it("shows local coding-agent context and account-limit details without exposing credentials", () => {
    const source = readFileSync(paneTreePath, "utf8");

    expect(source).toContain('invoke<AgentUsageStatus[]>("agent_usage_statuses"');
    expect(source).toContain("AgentUsageBadge");
    expect(source).toContain("AgentUsageMenu");
    expect(source).toContain("Context window");
    expect(source).toContain("Account limits");
  });

  it("delegates folder and branch navigation to the shared terminal controls", () => {
    const source = readFileSync(paneTreePath, "utf8");

    expect(source).toContain("onCd={(path) =>");
    expect(source).toContain("write(`cd ${shellQuote(path)}\\r`)");
    expect(source).toContain("TerminalNavigationControls");
    expect(source).toContain("onChangeDirectory={onCd}");
  });

  it("refreshes all pane git labels in the same repo after a branch switch", () => {
    const source = readFileSync(paneTreePath, "utf8");

    expect(source).toContain("GIT_REPO_CHANGED_EVENT");
    expect(source).toContain("gitRepoRootFromChangedEvent");
    expect(source).toContain("pathBelongsToRepo");
    expect(source).toContain("const gitInfoRequestRef = useRef(0);");
    expect(source).toContain("const refreshGitInfo = useCallback(async () =>");
    expect(source).toContain(
      "window.addEventListener(GIT_REPO_CHANGED_EVENT, handleGitRepoChanged);",
    );
    expect(source).toContain("pathBelongsToRepo(cwd, changedRepoRoot)");
  });
});

describe("PaneTreeView split resizing", () => {
  it("uses zoom-aware pane separator dragging and pauses terminal fit work during drag", () => {
    const source = readFileSync(paneTreePath, "utf8");

    expect(source).toContain("PANE_RESIZE_RESUME_DELAY_MS");
    expect(source).toContain("PANE_SPLIT_MIN_SIZE");
    expect(source).toContain('import { setTerminalResizePaused } from "./lib/rendererPool";');
    expect(source).toContain("groupRef={groupRef}");
    expect(source).toContain("disabled");
    expect(source).toContain("startZoomAwarePaneResize");
    expect(source).toContain("const zoomLevel = usePreferencesStore.getState().zoomLevel || 1;");
    expect(source).toContain("((latestPoint - startPoint) / zoomLevel / groupSize) * 100");
    expect(source).toContain("ownerWindow.requestAnimationFrame(applyLatestPoint)");
    expect(source).toContain("commitSplitLayout(latestLayout);");
    expect(source).toContain("defaultLayout={getDefaultLayout()}");
    expect(source).toContain("onPaneTreeChange({ ...splitNode, children: nextChildren });");
    expect(source).toContain("setTerminalResizePaused(true);");
    expect(source).toContain("setTerminalResizePaused(false);");
    expect(source).toContain('ownerDocument.addEventListener("pointermove", handlePointerMove);');
    expect(source).toContain('ownerDocument.addEventListener("pointerup", finish);');
    expect(source).toContain('ownerDocument.addEventListener("pointercancel", finish);');
    expect(source).toContain('ownerWindow.addEventListener("blur", finish);');
    expect(source).toContain("cursor-col-resize");
    expect(source).toContain("cursor-row-resize");
    expect(source).not.toContain("<ResizableHandle");
  });
});

describe("PaneTreeView header swapping", () => {
  it("keeps drag ownership on the header and highlights a leaf drop target", () => {
    const source = readFileSync(paneTreePath, "utf8");

    expect(source).toContain("data-pane-drag-handle");
    expect(source).toContain("onPointerDown={onDragStart}");
    expect(source).toContain("dragContext?.targetId === node.id");
    expect(source).toContain("ring-2 ring-inset ring-primary/80");
    expect(source).toContain("dragContext?.draggingId === node.id");
    expect(source).toContain("border-dashed border-primary/80");
    expect(source).toContain("dragContext?.targetOffset");
    expect(source).toContain("translate(${dragContext.targetOffset.x}px");
    expect(source).toContain("scale(0.985)");
    expect(source).toContain("opacity-90 shadow-xl shadow-primary/20");
    expect(source).toContain("transition-[transform,opacity,box-shadow]");
  });

  it("supports cancellation and commits a tree swap through the drag context", () => {
    const source = readFileSync(terminalStackPath, "utf8");

    expect(source).toContain('ownerDocument.addEventListener("pointercancel"');
    expect(source).toContain('ownerDocument.addEventListener("keydown"');
    expect(source).toContain('ownerWindow.addEventListener("blur"');
    expect(source).toContain("targetOffset");
    expect(source).toContain("swapLeafNodes");
    expect(source).toContain("swapLeafNodes(tab.paneTree");
  });
});

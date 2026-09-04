import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const rootSource = readFileSync(
  path.join(here, "ArchitectureCanvas.tsx"),
  "utf8",
);
const terminalLayerSource = readFileSync(
  path.join(here, "components/CanvasTerminalLayer.tsx"),
  "utf8",
);
const browserLayerSource = terminalLayerSource;
const dockTargetSource = readFileSync(
  path.join(here, "lib/useCanvasSurfaceDockTarget.ts"),
  "utf8",
);
const groupPointerSource = readFileSync(
  path.join(here, "lib/useCanvasTerminalGroupPointerDown.ts"),
  "utf8",
);
const pointerMoveSource = readFileSync(
  path.join(here, "lib/useCanvasPointerMove.ts"),
  "utf8",
);
const diagramSeedSource = readFileSync(
  path.join(here, "lib/architectureDiagramSeed.ts"),
  "utf8",
);
const diagramStateSource = readFileSync(
  path.join(here, "lib/useCanvasDiagramState.ts"),
  "utf8",
);
const terminalLayerActionsSource = readFileSync(
  path.join(here, "lib/useCanvasTerminalLayerActions.ts"),
  "utf8",
);
const browserLayerActionsSource = terminalLayerActionsSource;
const terminalViewModelSource = readFileSync(
  path.join(here, "lib/useCanvasTerminalViewModel.ts"),
  "utf8",
);
const placementSource = readFileSync(
  path.join(here, "lib/useCanvasSurfacePlacementActions.ts"),
  "utf8",
);
const diagramViewModelSource = readFileSync(
  path.join(here, "lib/useCanvasDiagramViewModel.ts"),
  "utf8",
);
const canvasPredicatesSource = readFileSync(
  path.join(here, "lib/architectureCanvasPredicates.ts"),
  "utf8",
);
const source = [
  rootSource,
  terminalLayerSource,
  browserLayerSource,
  dockTargetSource,
  groupPointerSource,
  pointerMoveSource,
  diagramSeedSource,
  diagramStateSource,
  terminalLayerActionsSource,
  browserLayerActionsSource,
  terminalViewModelSource,
  placementSource,
  diagramViewModelSource,
  canvasPredicatesSource,
].join("\n");
const dockingHookSource = [
  readFileSync(path.join(here, "lib/useCanvasDocking.ts"), "utf8"),
  readFileSync(path.join(here, "lib/useCanvasDockDividerResize.ts"), "utf8"),
].join("\n");
const dockingModelSource = readFileSync(
  path.join(here, "lib/canvasDockingModel.ts"),
  "utf8",
);
const dockingSource = [dockingHookSource, dockingModelSource].join("\n");
const canvasTypesSource = readFileSync(
  path.join(here, "lib/architectureCanvasTypes.ts"),
  "utf8",
);
const toolbarSource = readFileSync(
  path.join(here, "components/CanvasToolbar.tsx"),
  "utf8",
);
const shapeGestureSource = readFileSync(
  path.join(here, "lib/useCanvasShapeGestures.ts"),
  "utf8",
);
const dividerSource = readFileSync(
  path.join(here, "components/CanvasDockDivider.tsx"),
  "utf8",
);
const groupHeaderSource = readFileSync(
  path.join(here, "components/CanvasTerminalGroupHeader.tsx"),
  "utf8",
);
const terminalSurfaceSource = readFileSync(
  path.join(here, "components/CanvasTerminalSurface.tsx"),
  "utf8",
);
const terminalNavigationSource = readFileSync(
  path.join(here, "lib/useCanvasTerminalNavigation.ts"),
  "utf8",
);
const terminalInteractionModelSource = readFileSync(
  path.join(here, "lib/canvasTerminalInteractionModel.ts"),
  "utf8",
);
const terminalInteractionCommitSource = readFileSync(
  path.join(here, "lib/canvasTerminalInteractionCommit.ts"),
  "utf8",
);
const terminalInteractionSource = [
  terminalInteractionModelSource,
  terminalInteractionCommitSource,
].join("\n");

describe("ArchitectureCanvas terminal docking integration", () => {
  it("delegates dock layout orchestration to the extracted docking hook", () => {
    expect(source).toContain(
      'import { useCanvasDocking } from "./lib/useCanvasDocking";',
    );
    expect(source).toContain("const docking = useCanvasDocking({");
    expect(source).not.toContain(
      "const [terminalDockDropTarget, setTerminalDockDropTarget]",
    );
    expect(source).not.toContain(
      "const [dockDividerResize, setDockDividerResize]",
    );
    expect(source).not.toContain(
      "const terminalPlacementObstacles = useMemo(() =>",
    );

    expect(dockingSource).toContain("projectTerminalDockLayouts");
    expect(dockingHookSource).toContain("resolveTerminalDockDrop");
    expect(dockingHookSource).toContain("updateTerminalDockSplitRatio");
    expect(dockingHookSource).toContain("terminalDockIndicatorRect");
  });

  it("resizes the outer dock group instead of an individual terminal leaf", () => {
    expect(canvasTypesSource).toContain("terminalGroupId?: string");
    expect(source).toContain("updateTerminalGroupBounds");
    expect(shapeGestureSource).toContain("resize.terminalGroupId");
  });

  it("maximizes a terminal as transient view state without rewriting saved bounds", () => {
    expect(source).toContain("maximizedTerminalId");
    expect(source).not.toContain("terminalRestoreBoundsRef");
  });

  it("uses the shared Cmd/Ctrl+> maximize shortcut for canvas terminals", () => {
    expect(terminalNavigationSource).toContain('event.code === "Period"');
    expect(terminalNavigationSource).not.toContain('event.key.toLowerCase() === "m"');
  });

  it("continues node and edge IDs after restoring a saved canvas", () => {
    expect(source).toContain("nextDiagramIdSequence");
    expect(source).toContain(
      "initialDiagram.nodes.map((node) => node.id)",
    );
    expect(source).toContain(
      "initialDiagram.edges.map((edge) => edge.id)",
    );
  });

  it("batches dock divider resizing to one layout update per animation frame", () => {
    expect(dockingHookSource).toContain("dockDividerResizeFrameRef");
    expect(dockingHookSource).toContain("requestAnimationFrame(() =>");
    expect(dockingHookSource).toContain("flushDockDividerResize");
  });

  it("pauses Canvas xterm fitting while a dock divider is being dragged", () => {
    expect(dockingHookSource).toContain("const terminalResizePaused =");
    expect(terminalSurfaceSource).toContain("resizePaused={terminalResizePaused}");
  });

  it("bridges pan and zoom gestures from terminals back to the canvas camera", () => {
    expect(source).toContain('panning={mode === "pan"}');
    expect(source).toContain("onCanvasPanStart={actions.onCanvasPanStart}");
    expect(source).toContain("onCanvasPanMove={actions.onCanvasPanMove}");
    expect(source).toContain("onCanvasWheel={actions.onCanvasWheel}");
  });

  it("renders shared group controls only for multi-terminal dock groups", () => {
    expect(groupHeaderSource).toContain('data-canvas-terminal-group-header="true"');
    expect(source).toContain("renderedTerminalDockGroups.map((group) => {");
    expect(source).toContain("terminalDockGroupUsesSharedHeader(group)");
    expect(groupHeaderSource).toContain("onClick={onClose}");
    expect(source).toContain("terminalIds.includes(item.id)");
    expect(terminalSurfaceSource).toContain("singleTerminalGroup={!usesSharedHeader}");
    expect(terminalSurfaceSource).toContain("onRequestCloseTerminalGroup={onRequestCloseGroup}");
  });

  it("drags the shared header by moving the whole dock group", () => {
    expect(source).toContain("handleTerminalGroupHeaderPointerDown");
    expect(source).toContain("terminalGroupId: group.id");
    expect(source).toContain("drag.terminalGroupId");
    expect(source).toContain(
      "updateTerminalGroupBounds(current, drag.terminalGroupId!, nextBounds)",
    );
  });

  it("detaches a dragged tab without moving its entire dock group", () => {
    expect(source).toContain("onTabPointerDown={actions.onTabPointerDown}");
    expect(source).toContain("const surfaceNode = nodeById.get(surfaceId)");
    expect(source).toContain("handleNodePointerDown(");
    expect(source).toContain("surfaceNode,");
  });

  it("uses rendered dock-group bounds as terminal placement obstacles", () => {
    expect(dockingSource).toContain("buildTerminalPlacementObstacles");
    expect(dockingSource).toContain("const dockedTerminalIds = new Set(");
    expect(dockingSource).toContain(
      "terminalDockGroups.map(({ x, y, width, height }) => ({",
    );
    expect(source).toContain("terminalPlacementObstacles,");
  });

  it("keeps single-terminal group drags dockable", () => {
    expect(source).toContain("terminalDockGroupUsesSharedHeader(terminalGroup)");
    expect(source).toContain("if (terminalGroup && !terminalDockGroupUsesSharedHeader(terminalGroup))");
    expect(source).toContain("setTerminalDropPreview({");
    expect(dockingSource).toContain("resolveTerminalDockDrop(");
    expect(terminalInteractionSource).toContain('result.kind === "detach"');
  });

  it("creates header tabs and right splits through the persisted dock model", () => {
    expect(source).toContain("createDockedSurface");
    expect(source).toContain('kind: "tab" | "split"');
    expect(source).toContain("onAddTab={(initialCommand) =>");
    expect(source).toContain("onSplitRight={() =>");
    expect(source).toContain('edge: "right"');
    expect(source).toContain("dockTerminal(");
  });

  it("keeps the newly created tab visible when adding inside a maximized group", () => {
    expect(source).toContain("maximizedTerminalId === source.id");
    expect(source).toContain("setMaximizedTerminalId(result.created.id)");
  });

  it("maximizes every pane and divider in the selected dock group", () => {
    expect(source).toContain("projectMaximizedTerminalDockGroups(");
    expect(source).toContain(
      "const renderedLayout = renderedTerminalLayoutById.get(node.id)",
    );
    expect(source).toContain("<CanvasDockDivider");
    expect(dividerSource).toContain("role=\"separator\"");
    expect(source).not.toContain("(!maximizedTerminalId || maximized)");
  });

  it("arms terminal placement instead of centering it immediately", () => {
    expect(toolbarSource).toContain(
      'onClick={() => onBeginSurfacePlacement("terminal")}',
    );
    expect(source).not.toContain('beginSurfacePlacement("editor")');
    expect(source).toContain("const commitSurfacePlacement = (");
    expect(source).toContain("pendingSurfaceKind");
    expect(source).not.toContain("function createInteractiveSurface(");
  });

  it("uses the persisted dock model for every live canvas surface", () => {
    expect(source).toContain("const liveSurfaceNodes = nodes.filter(isLiveSurfaceNode)");
    expect(source).toContain("createDockedSurface");
    expect(source).toContain("isLiveSurfaceKind(dragged.kind)");
    expect(source).toMatch(/normalizeTerminalDockGroups\(\s*liveSurfaceNodes/);
  });

  it("allows terminal surfaces to share dock targets", () => {
    expect(source).toContain("projectTerminalDockLayouts");
    expect(source).toContain("terminalLayouts,");
    expect(source).not.toContain("compatibleDockLayouts(");
  });

  it("closes a tab independently while a single terminal can close its group", () => {
    expect(source).toContain("onRequestCloseTab={(terminalId) =>");
    expect(source).toContain("eraseNode(args.terminalId)");
    expect(source).toContain("const closeTerminalGroup = (");
    expect(groupHeaderSource).toContain("onClick={onClose}");
    expect(terminalSurfaceSource).toContain(
      "onRequestCloseTerminalGroup={onRequestCloseGroup}",
    );
  });
});

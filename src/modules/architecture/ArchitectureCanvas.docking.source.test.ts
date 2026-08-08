import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const canvasPath = path.join(here, "ArchitectureCanvas.tsx");
const source = readFileSync(
  path.join(here, "ArchitectureCanvas.tsx"),
  "utf8",
);

describe("ArchitectureCanvas terminal docking integration", () => {
  it("resizes the outer dock group instead of an individual terminal leaf", () => {
    expect(source).toContain("terminalGroupId?: string");
    expect(source).toContain("updateTerminalGroupBounds");
    expect(source).toContain("resize.terminalGroupId");
  });

  it("maximizes a terminal as transient view state without rewriting saved bounds", () => {
    expect(source).toContain("maximizedTerminalId");
    expect(source).not.toContain("terminalRestoreBoundsRef");
  });

  it("uses the shared Cmd/Ctrl+> maximize shortcut for canvas terminals", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain('event.key === ">"');
    expect(canvasSource).toContain("event.shiftKey");
    expect(canvasSource).not.toContain('event.key.toLowerCase() === "m"');
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
    expect(source).toContain("dockDividerResizeFrameRef");
    expect(source).toContain("requestAnimationFrame(() =>");
    expect(source).toContain("flushDockDividerResize");
  });

  it("pauses Canvas xterm fitting while a dock divider is being dragged", () => {
    expect(source).toContain("const terminalResizePaused =");
    expect(source).toContain("resizePaused={terminalResizePaused}");
  });

  it("bridges pan and zoom gestures from terminals back to the canvas camera", () => {
    expect(source).toContain('panning={mode === "pan"}');
    expect(source).toContain("onCanvasPanStart={(event) =>");
    expect(source).toContain("onCanvasPanMove={(event) =>");
    expect(source).toContain("onCanvasWheel={(event) =>");
  });

  it("renders shared group controls only for multi-terminal dock groups", () => {
    expect(source).toContain('data-canvas-terminal-group-header="true"');
    expect(source).toContain("terminalDockGroups.map((group) => {");
    expect(source).toContain("terminalDockGroupUsesSharedHeader(group)");
    expect(source).toContain("onClick={() => closeTerminalGroup(group)}");
    expect(source).toContain("terminalIds.includes(item.id)");
    expect(source).toContain("singleTerminalGroup={!usesSharedHeader}");
    expect(source).toContain("onRequestCloseTerminalGroup={() =>");
  });

  it("drags the shared header by moving the whole dock group", () => {
    expect(source).toContain("handleTerminalGroupHeaderPointerDown");
    expect(source).toContain("terminalGroupId: group.id");
    expect(source).toContain("const terminalGroupId = drag.terminalGroupId");
    expect(source).toContain(
      "updateTerminalGroupBounds(current, terminalGroupId",
    );
  });

  it("uses rendered dock-group bounds as terminal placement obstacles", () => {
    expect(source).toContain("const terminalPlacementObstacles = useMemo(() =>");
    expect(source).toContain("const dockedTerminalIds = new Set(");
    expect(source).toContain("terminalDockGroups.map(({ x, y, width, height }) => ({");
    expect(source).toContain("terminalPlacementObstacles,");
  });

  it("keeps single-terminal group drags dockable", () => {
    expect(source).toContain("const isSingleTerminalGroup =");
    expect(source).toContain("if (isSingleTerminalGroup)");
    expect(source).toContain("setTerminalDropPreview({");
    expect(source).toContain("resolveTerminalDockDrop(");
    expect(source).toContain("} else if (!drag.terminalGroupId) {");
  });

  it("creates header tabs and right splits through the persisted dock model", () => {
    expect(source).toContain("function createDockedTerminal(");
    expect(source).toContain('kind: "tab" | "split"');
    expect(source).toContain("onAddTab={() =>");
    expect(source).toContain("onSplitRight={() =>");
    expect(source).toContain('edge: "right"');
    expect(source).toContain("dockTerminal(");
  });

  it("closes a tab independently while a single terminal can close its group", () => {
    expect(source).toContain("onRequestCloseTab={(terminalId) => {");
    expect(source).toContain("eraseNode(terminalId)");
    expect(source).toContain("const closeTerminalGroup = (");
    expect(source).toContain("onClick={() => closeTerminalGroup(group)}");
    expect(source).toContain("onRequestCloseTerminalGroup={() =>");
  });
});

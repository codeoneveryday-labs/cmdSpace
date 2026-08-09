import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const stackPath = path.join(here, "ArchitectureStack.tsx");
const indexPath = path.join(here, "index.ts");
const lazyStackPath = path.join(here, "ArchitectureStackLazy.tsx");
const errorBoundaryPath = path.join(here, "ArchitectureErrorBoundary.tsx");
const canvasPath = path.join(here, "ArchitectureCanvas.tsx");
const canvasTerminalPath = path.join(here, "CanvasTerminalNode.tsx");
const preferencesPath = path.join(here, "../settings/store.ts");
const tabsPath = path.join(here, "../tabs/lib/useTabs.ts");
const tabBarPath = path.join(here, "../tabs/TabBar.tsx");
const appPath = path.join(here, "../../app/App.tsx");

describe("Architecture workspace page", () => {
  it("loads the Architecture canvas from the main bundle instead of a blank lazy boundary", () => {
    const indexSource = readFileSync(indexPath, "utf8");

    expect(indexSource).toContain(
      'export { ArchitectureStack } from "./ArchitectureStack";',
    );
    expect(existsSync(lazyStackPath)).toBe(false);
  });

  it("contains a local recovery state instead of crashing the full app when the canvas throws", () => {
    const stackSource = readFileSync(stackPath, "utf8");
    const boundarySource = readFileSync(errorBoundaryPath, "utf8");

    expect(stackSource).toContain("ArchitectureErrorBoundary");
    expect(boundarySource).toContain("getDerivedStateFromError");
    expect(boundarySource).toContain("Architecture could not start");
    expect(boundarySource).toContain("Try again");
  });

  it("removes inactive canvas tasks from layout without destroying their PTYs", () => {
    const stackSource = readFileSync(stackPath, "utf8");
    const appSource = readFileSync(appPath, "utf8");

    expect(stackSource).toContain('!visible && "hidden pointer-events-none"');
    expect(appSource).toContain('!isArchitectureTab && "hidden pointer-events-none"');
  });

  it("keeps a custom canvas background separate from the app background", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");
    const preferencesSource = readFileSync(preferencesPath, "utf8");

    expect(preferencesSource).toContain("canvasBackgroundImageId");
    expect(preferencesSource).toContain("setCanvasBackgroundImageId");
    expect(canvasSource).toContain("CanvasBackgroundMedia");
    expect(canvasSource).toContain("getBgImage");
    expect(canvasSource).toContain("useBackgroundVideoPlayback");
    expect(canvasSource).toContain('pointerEvents: "none"');
    expect(canvasSource).toContain('"relative z-10 block h-full w-full"');
    expect(canvasSource).toContain('"pointer-events-none absolute inset-0 z-20"');
    expect(canvasSource).toContain("<video");
    expect(canvasSource).toContain("        autoPlay\n");
    expect(canvasSource).not.toContain("        src={media.url}\n");
  });

  it("themes the canvas status and focus controls with semantic colors", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain(
      "border border-border/70 bg-background/85 px-2 py-1 text-[10px] text-muted-foreground",
    );
    expect(canvasSource).toContain(
      "border border-border/70 bg-background/90 text-muted-foreground",
    );
    expect(canvasSource).not.toContain(
      "border border-zinc-200 bg-white/85 px-2 py-1 text-[10px] text-zinc-500",
    );
  });

  it("adds Architecture as a first-class tab type", () => {
    const tabsSource = readFileSync(tabsPath, "utf8");
    const tabBarSource = readFileSync(tabBarPath, "utf8");
    const appSource = readFileSync(appPath, "utf8");
    const stackSource = readFileSync(stackPath, "utf8");
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(tabsSource).toContain("export type ArchitectureTab");
    expect(tabsSource).toContain('kind: "architecture"');
    expect(tabsSource).toContain("newArchitectureTab");
    expect(tabBarSource).toContain("onNewArchitecture");
    expect(tabBarSource).toContain('label="Architecture"');
    expect(tabBarSource).toContain("CanvasIcon");
    expect(tabBarSource).not.toContain("AiNetworkIcon");
    expect(appSource).toContain("<ArchitectureStack");
    expect(appSource).toContain("canvasFocused={canvasFocused}");
    expect(appSource).toContain("onToggleCanvasFocus={toggleCanvasFocus}");
    expect(stackSource).toContain("onToggleCanvasFocus");
    expect(canvasSource).toContain("function CanvasFocusIcon");
    expect(canvasSource).toContain('"Focus canvas"');
  });

  it("attaches live surfaces to frames and keeps them with the frame when it moves", () => {
    const tabsSource = readFileSync(tabsPath, "utf8");
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(tabsSource).toContain("frameId?: string;");
    expect(canvasSource).toContain("function snapTerminalFrame");
    expect(canvasSource).toContain("isFrameAttachableKind(dragged.kind)");
    expect(canvasSource).toContain("frameId: nextFrameId");
    expect(canvasSource).toContain("isFrameAttachableKind(item.kind)");
    expect(canvasSource).toContain('kind === "terminal" || kind === "browser"');
    expect(canvasSource).toContain("groupIds.has(item.frameId)");
    expect(canvasSource).toContain("moveTerminalDockGroups");
    expect(canvasSource).toContain("attachedTerminalGroupIds");
    expect(canvasSource).toContain("snapTerminalFrame(terminalGroup, nodes)");
  });

  it("returns one-shot tools to Select while preserving Pen and Pan", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain('if (drawing && drawing.kind !== "pen")');
    expect(canvasSource).toContain("setMode(\"select\");");
    expect(canvasSource).toContain("const toggleSelectedLock = () => {");
    expect(canvasSource).toContain("const undoCanvas = () => {");
    expect(canvasSource).toContain('onClick={() => setMode("pen")}');
    expect(canvasSource).toContain('onClick={() => {\n              setMode("pan");');
  });

  it("uses a bounded flex viewport for real canvas terminal scrollback", () => {
    const terminalSource = readFileSync(canvasTerminalPath, "utf8");

    expect(terminalSource).toContain("flex h-full min-h-0 w-full flex-col");
    expect(terminalSource).toContain("cmdspace-canvas-terminal-viewport");
    expect(terminalSource).toContain("min-h-0 min-w-0 flex-1 overflow-hidden");
  });

  it("lets xterm own keyboard input even while a canvas text tool is active", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");
    const terminalSource = readFileSync(canvasTerminalPath, "utf8");

    expect(canvasSource).toContain('target.closest(".xterm")');
    expect(terminalSource).toContain("terminalRef.current?.focus()");
  });

  it("provides a usable architecture canvas with C4-style shapes and Mermaid export", () => {
    const stackSource = readFileSync(stackPath, "utf8");
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(stackSource).toContain("ArchitectureCanvas");
    expect(canvasSource).toContain("ARCHITECTURE_SHAPES");
    expect(canvasSource).toContain("Service");
    expect(canvasSource).toContain("API");
    expect(canvasSource).toContain("Database");
    expect(canvasSource).toContain("Cache");
    expect(canvasSource).toContain("Queue");
    expect(canvasSource).toContain("Storage");
    expect(canvasSource).toContain("Rectangle");
    expect(canvasSource).toContain("Circle");
    expect(canvasSource).toContain("Frame");
    expect(canvasSource).toContain("Text");
    expect(canvasSource).toContain("Image");
    expect(canvasSource).toContain("terminal");
    expect(canvasSource).toContain("Add terminal");
    expect(canvasSource).not.toContain('label="Image"');
    expect(canvasSource).toContain("terminalNodes");
    expect(canvasSource).toContain("CanvasTerminalNode");
    expect(canvasSource).toContain("TERMINAL_DEFAULT_SIZE");
    expect(canvasSource).toContain("width: 640, height: 400");
    expect(canvasSource).toContain("centerViewOnPlacement");
    expect(canvasSource).toContain("activeTerminalId");
    expect(canvasSource).toContain("Line");
    expect(canvasSource).toContain("Arrow");
    expect(canvasSource).toContain("Gateway");
    expect(canvasSource).toContain("Security");
    expect(canvasSource).toContain("Boundary");
    expect(canvasSource).toContain("AI service");
    expect(canvasSource).toContain("External");
    expect(canvasSource).not.toContain("Copy Mermaid");
    expect(canvasSource).not.toContain("copyMermaid");
    expect(canvasSource).not.toContain("downloadSvg");
    expect(canvasSource).not.toContain(
      'size="icon-xs" variant="ghost" onClick={resetView} title="Fit view"',
    );
    expect(canvasSource).toContain("<svg");
  });

  it("starts empty without an overlay and keeps the full drawable grid square", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain("const [nodes, setNodes] = useState<ArchitectureNode[]>(");
    expect(canvasSource).toContain("ResizeObserver");
    expect(canvasSource).toContain("canvasSize.width / view.scale");
    expect(canvasSource).toContain("canvasSize.height / view.scale");
    expect(canvasSource).toContain('preserveAspectRatio="none"');
    expect(canvasSource).not.toContain("Blank canvas");
    expect(canvasSource).not.toContain("Pick a shape");
    expect(canvasSource).not.toContain("ARCHITECTURE_TEMPLATES");
    expect(canvasSource).not.toContain("<SectionTitle>Templates</SectionTitle>");
    expect(canvasSource).not.toContain("loadTemplate");
    expect(canvasSource).not.toContain("start from a template");
    expect(canvasSource).not.toContain("const INITIAL_NODES");
    expect(canvasSource).not.toContain("const INITIAL_EDGES");
  });

  it("keeps core diagram operations available from the canvas-only workspace", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain(
      'type CanvasMode = "select" | "pan" | "connect" | "rectangle" | "circle" | "line" | "arrow" | "pen" | "text" | "image" | "terminal" | "frame" | "eraser"',
    );
    expect(canvasSource).toContain("selectedEdgeId");
    expect(canvasSource).toContain("historyRef");
    expect(canvasSource).toContain("undoCanvas");
    expect(canvasSource).toContain("toggleSelectedLock");
    expect(canvasSource).toContain("const handleCanvasUndo = (event: KeyboardEvent) => {");
    expect(canvasSource).toContain('event.key.toLowerCase() !== "z"');
    expect(canvasSource).toContain("event.metaKey || event.ctrlKey");
    expect(canvasSource).toContain("undoCanvas();");
    expect(canvasSource).toContain("locked");
    expect(canvasSource).toContain("Zoom in");
    expect(canvasSource).toContain("Zoom out");
    expect(canvasSource).toContain("function clampView");
    expect(canvasSource).toContain("function clampViewCoord");
  });

  it("lets the pan tool move the canvas in every direction", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain("CANVAS_PAN_MARGIN_RATIO");
    expect(canvasSource).toContain("function canvasPanMargin");
    expect(canvasSource).toContain("Math.max(viewportSize, canvasPixels / MIN_ZOOM)");
    expect(canvasSource).toContain("const slack = canvasPanMargin(viewportSize, canvasPixels)");
    expect(canvasSource).toContain("const min = -slack");
    expect(canvasSource).toContain("const max = Math.max(canvasSize - viewportSize, 0) + slack");
    expect(canvasSource).toContain("function drawableBounds(): { x: number; y: number; width: number; height: number }");
    expect(canvasSource).toContain("const x = Math.min(0, view.x)");
    expect(canvasSource).toContain("const y = Math.min(0, view.y)");
    expect(canvasSource).not.toContain("clamp(value, 0, Math.max(0, canvasSize - viewportSize))");
  });

  it("supports single-key shortcuts for canvas tools while active", () => {
    const stackSource = readFileSync(stackPath, "utf8");
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(stackSource).toContain("active={visible}");
    expect(canvasSource).toContain("active: boolean");
    expect(canvasSource).toContain("ARCHITECTURE_TOOL_SHORTCUTS");
    expect(canvasSource).toContain('["v", "select"]');
    expect(canvasSource).toContain('["h", "pan"]');
    expect(canvasSource).toContain('["c", "connect"]');
    expect(canvasSource).toContain('["l", "line"]');
    expect(canvasSource).toContain('["a", "arrow"]');
    expect(canvasSource).toContain('["p", "pen"]');
    expect(canvasSource).toContain('["t", "text"]');
    expect(canvasSource).toContain('["i", "terminal"]');
    expect(canvasSource).not.toContain('["i", "image"]');
    expect(canvasSource).toContain('["f", "frame"]');
    expect(canvasSource).toContain('["e", "eraser"]');
    expect(canvasSource).toContain("isEditableShortcutTarget");
    expect(canvasSource).toContain('event.key === "Escape"');
    expect(canvasSource).toContain("const title = shortcut ? `${label} (${shortcut})` : label");
    expect(canvasSource).toContain("title={title}");
  });

  it("uses a large open-palm pan control and a simple dash for the line tool", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain("function PanToolIcon()");
    expect(canvasSource).toContain("iconNode={<PanToolIcon />}");
    expect(canvasSource).toContain("icon={MinusSignIcon}");
    expect(canvasSource).toContain('className="h-7 w-7 shrink-0"');
  });

  it("deletes the selected canvas element from the keyboard", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain("const handleDeleteKey = (event: KeyboardEvent) => {");
    expect(canvasSource).toContain('event.key !== "Delete" && event.key !== "Backspace"');
    expect(canvasSource).toContain("if (!selectedNode && !selectedEdge) return;");
    expect(canvasSource).toContain("isEditableShortcutTarget(event.target)");
    expect(canvasSource).toContain("removeSelectedNode();");
    expect(canvasSource).toContain("removeSelectedEdge();");
    expect(canvasSource).toContain('window.addEventListener("keydown", handleDeleteKey);');
  });

  it("creates and edits text directly from a canvas double click", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain("editingTextId");
    expect(canvasSource).toContain("handleCanvasDoubleClick");
    expect(canvasSource).toContain('onDoubleClick={handleCanvasDoubleClick}');
    expect(canvasSource).toContain('createNode("text", point)');
    expect(canvasSource).toContain("setEditingTextId(created.id)");
    expect(canvasSource).toContain("handleNodeDoubleClick");
    expect(canvasSource).toContain("setEditingTextId(item.id)");
    expect(canvasSource).toContain("<textarea");
    expect(canvasSource).toContain("autoFocus");
    expect(canvasSource).toContain('<foreignObject x="0" y="0" width={node.width} height={node.height}>');
    expect(canvasSource).toContain("editing={item.id === editingTextId}");
    expect(canvasSource).toContain('editing && "opacity-0"');
    expect(canvasSource).toContain("bg-transparent");
    expect(canvasSource).toContain("border-0");
    expect(canvasSource).toContain("spellCheck={false}");
    expect(canvasSource).toContain('autoCorrect="off"');
    expect(canvasSource).toContain("className=\"flex h-full items-center\"");
    expect(canvasSource).toContain("height: Math.min(");
    expect(canvasSource).toContain("node.height,");
    expect(canvasSource).toContain("Math.max(lineHeight, lines.length * lineHeight)");
    expect(canvasSource).toContain("onTextChange(event.target.value)");
    expect(canvasSource).toContain("onBlur={onTextEditEnd}");
    expect(canvasSource).toContain("updateTextNodeLabel(item.id, label)");
    expect(canvasSource).not.toContain("bg-background/95 px-3 py-2");
    expect(canvasSource).not.toContain('x="-14"');
  });

  it("keeps text labels centered and grows bounds to fit content", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain('case "text":\n      return { width: 112, height: 40 };');
    expect(canvasSource).toContain('case "text":\n      return { width: 48, height: 32 };');
    expect(canvasSource).toContain("function measureTextNodeSize");
    expect(canvasSource).toContain("function fitTextNode");
    expect(canvasSource).toContain("textNodeLines(label || \"Text\")");
    expect(canvasSource).toContain("Math.ceil(maxChars * 14 + 28)");
    expect(canvasSource).toContain("fitTextNode({ ...node, label })");
    expect(canvasSource).toContain("x={node.width / 2}");
    expect(canvasSource).toContain("y={node.height / 2}");
    expect(canvasSource).toContain('textAnchor="middle"');
    expect(canvasSource).toContain('dominantBaseline="middle"');
    expect(canvasSource).toContain("text-center text-[24px]");
    expect(canvasSource).not.toContain("<foreignObject\n            x=\"-14\"");
    expect(canvasSource).not.toContain("x: point.x,\n      y: point.y - 28");
  });

  it("lets edge arrowheads overlap target bounds to avoid visible gaps", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain("const EDGE_NODE_OVERLAP = 4;");
    expect(canvasSource).toContain("edgeAnchorPoint(from, to, false)");
    expect(canvasSource).toContain("edgeAnchorPoint(to, from, true)");
    expect(canvasSource).toContain("const scale = Math.min(");
    expect(canvasSource).toContain("halfWidth / Math.abs(dx)");
    expect(canvasSource).toContain("halfHeight / Math.abs(dy)");
  });

  it("supports multiline text editing and Shift multi-select group movement", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain("selectedNodeIds");
    expect(canvasSource).toContain("event.shiftKey");
    expect(canvasSource).toContain("current.includes(item.id)");
    expect(canvasSource).toContain("setSelectedNodeId(next[next.length - 1] ?? \"\")");
    expect(canvasSource).toContain("selected={selectedNodeIds.includes(item.id)}");
    expect(canvasSource).toContain("updateDraggedNodes(current, drag, point, bounds, selectedNodeIds)");
    expect(canvasSource).toContain("const width = drag.sourceBounds?.width ?? node.width");
    expect(canvasSource).toContain("const height = drag.sourceBounds?.height ?? node.height");
    expect(canvasSource).toContain("bounds.x + 16");
    expect(canvasSource).toContain("bounds.x + bounds.width - width - 16");
    expect(canvasSource).toContain("bounds.y + 16");
    expect(canvasSource).toContain("bounds.y + bounds.height - height - 16");
    expect(canvasSource).toContain("Resize terminal from ${corner.handle} corner");
    expect(canvasSource).toContain('handle: "nw" as const');
    expect(canvasSource).toContain('handle: "ne" as const');
    expect(canvasSource).toContain('handle: "se" as const');
    expect(canvasSource).toContain('handle: "sw" as const');
    expect(canvasSource).not.toContain("rounded-sm border-2 border-blue-500 bg-white");
    expect(canvasSource).toContain("Drop to place");
    expect(canvasSource).toContain("maximizedTerminalId");
    expect(canvasSource).not.toContain("terminalRestoreBoundsRef");
    expect(canvasSource).toContain("function inheritedTerminalCwd");
    expect(canvasSource).toContain("cwd: inheritedTerminalCwd()");
    expect(canvasSource).toContain("svgRef.current?.setPointerCapture(event.pointerId)");
    expect(canvasSource).toContain("selectedNodeIds.includes(dragged.id) ? selectedNodeIds : [dragged.id]");
    expect(canvasSource).toContain("groupIds.has(item.id)");
    expect(canvasSource).toContain("function textNodeLines");
    expect(canvasSource).toContain("value.split(/\\r?\\n/)");
    expect(canvasSource).toContain("<textarea");
    expect(canvasSource).toContain("resize-none");
    expect(canvasSource).toContain("<tspan");
  });

  it("supports trackpad pinch zoom around the cursor on the canvas", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain("WheelEvent as ReactWheelEvent");
    expect(canvasSource).toContain("handleCanvasWheel");
    expect(canvasSource).toContain("onWheel={handleCanvasWheel}");
    expect(canvasSource).toContain("!event.ctrlKey && !event.metaKey");
    expect(canvasSource).toContain("const delta = wheelPanDelta(event)");
    expect(canvasSource).toContain("x: current.x + delta.x / current.scale");
    expect(canvasSource).toContain("y: current.y + delta.y / current.scale");
    expect(canvasSource).toContain("event.preventDefault()");
    expect(canvasSource).toContain("Math.exp(-event.deltaY * 0.002)");
    expect(canvasSource).toContain("focal.x - localX * nextWidth");
    expect(canvasSource).toContain("focal.y - localY * nextHeight");
    expect(canvasSource).toContain("TRACKPAD_PAN_SENSITIVITY = 0.35");
    expect(canvasSource).toContain("function wheelPanDelta(event: ReactWheelEvent<SVGSVGElement>): Point");
    expect(canvasSource).toContain("event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? 240 : 1");
    expect(canvasSource).toContain("event.deltaX * multiplier * TRACKPAD_PAN_SENSITIVITY");
    expect(canvasSource).toContain("event.deltaY * multiplier * TRACKPAD_PAN_SENSITIVITY");
  });

  it("draws selected drawing shapes by drag-sizing them on the canvas", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain('mode: "rectangle"');
    expect(canvasSource).toContain('mode: "circle"');
    expect(canvasSource).toContain("isShapeDrawingMode(mode)");
    expect(canvasSource).toContain("createNode(mode, point, true)");
    expect(canvasSource).toContain("resizeShapeNode");
    expect(canvasSource).toContain("normalizeDragRect");
    expect(canvasSource).not.toContain('if (drawing?.kind === "pen") setMode("select");');
    expect(canvasSource).not.toContain('if (mode === "text" || mode === "image" || mode === "frame")');
  });

  it("keeps Pen in the bottom dock without rendering sidebars", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain('className="absolute bottom-6 left-1/2');
    expect(canvasSource).toContain('rounded-[2.5rem]');
    expect(canvasSource).toContain(
      'className="relative h-full min-h-0 overflow-hidden bg-[#fbfdfc] dark:bg-zinc-950"',
    );
    expect(canvasSource).not.toContain("ARCHITECTURE_PALETTE_SHAPES");
    expect(canvasSource).not.toContain("COMPACT_PALETTE_KINDS");
    expect(canvasSource).not.toContain("Collapse shape palette");
    expect(canvasSource).not.toContain("Collapse inspector");
    expect(canvasSource).toContain('label="Pen"');
    expect(canvasSource).toContain('shortcut={ARCHITECTURE_TOOL_SHORTCUT_LABELS.pen}');
    expect(canvasSource).toContain("const handlePointerEnd = () => {");
    expect(canvasSource).not.toContain('if (drawing?.kind === "pen") setMode("select");');
  });

  it("renders primitive shapes cleanly with resize and rotate handles when selected", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain("rotation?: number");
    expect(canvasSource).toContain('type ResizeHandle = "nw" | "ne" | "se" | "sw"');
    expect(canvasSource).toContain("type RotateState");
    expect(canvasSource).toContain('node.kind === "rectangle"');
    expect(canvasSource).toContain("SelectionHandles");
    expect(canvasSource).toContain("data-resize-handle");
    expect(canvasSource).toContain("data-rotate-handle");
    expect(canvasSource).toContain("handleResizePointerDown");
    expect(canvasSource).toContain("handleRotatePointerDown");
    expect(canvasSource).toContain("updateRotatingNode");
    expect(canvasSource).toContain("rotate(");
    expect(canvasSource).toContain('className="fill-foreground text-[24px] font-semibold"');
    expect(canvasSource).toContain('textAnchor="middle"');
    expect(canvasSource).toContain('fill="none"');
    expect(canvasSource).not.toContain('node.kind === "rectangle" ?');
    expect(canvasSource).not.toContain('{node.label || "Frame"}');
    expect(canvasSource).not.toContain('{node.label || "Circle"}');
    expect(canvasSource).not.toContain("Generic shape, box, note, or container</div>");
  });

  it("lets selected line and arrow drawings be reshaped from both ends and the middle curve handle", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain('type ConnectorHandle = "start" | "control" | "end"');
    expect(canvasSource).toContain("type ConnectorHandleState");
    expect(canvasSource).toContain("handleConnectorPointerDown");
    expect(canvasSource).toContain("updateConnectorHandle");
    expect(canvasSource).toContain("ConnectorHandles");
    expect(canvasSource).toContain("data-connector-handle");
    expect(canvasSource).toContain("connectorPath(node)");
    expect(canvasSource).toContain("connectorControlPoint(node)");
    expect(canvasSource).not.toContain("<line\n          x1=\"0\"");
  });

  it("snaps connector endpoints to nearby canvas shapes and keeps them attached", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain("connectorStartId?: string");
    expect(canvasSource).toContain("connectorEndId?: string");
    expect(canvasSource).toContain("CONNECTOR_SNAP_DISTANCE");
    expect(canvasSource).toContain("resolveConnectorNode");
    expect(canvasSource).toContain("snapConnectorEndpoint");
    expect(canvasSource).toContain("boundaryPoint");
    expect(canvasSource).toContain("nodes.map((item) => {");
    expect(canvasSource).toContain("resolveConnectorNode(item, nodes)");
    expect(canvasSource).toContain("connector.handle === \"start\" ? \"connectorStartId\" : \"connectorEndId\"");
  });

  it("attaches dragged text labels to nearby canvas elements", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    expect(canvasSource).toContain("textAnchorId?: string");
    expect(canvasSource).toContain("TEXT_ATTACH_DISTANCE");
    expect(canvasSource).toContain("updateDraggedNodes(current, drag, point, bounds, selectedNodeIds)");
    expect(canvasSource).toContain("function snapTextAttachment");
    expect(canvasSource).toContain("pointInsideNode(center, node)");
    expect(canvasSource).toContain('dragged.kind === "text"');
    expect(canvasSource).toContain("textAnchorId: nextAnchor");
    expect(canvasSource).toContain("groupIds.has(item.textAnchorId)");
    expect(canvasSource).toContain("x: item.x + dx");
    expect(canvasSource).toContain("y: item.y + dy");
  });

  it("renders primitive circles as hollow outline shapes", () => {
    const canvasSource = readFileSync(canvasPath, "utf8");

    const circleBranch = canvasSource.slice(
      canvasSource.indexOf('if (node.kind === "circle")'),
      canvasSource.indexOf('if (node.kind === "text")'),
    );

    expect(circleBranch).toContain("<ellipse");
    expect(circleBranch).toContain('fill="none"');
    expect(circleBranch).not.toContain("fill-background");
  });
});

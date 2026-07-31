import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePreferencesStore } from "@/modules/settings/preferences";
import type {
  ArchitectureDiagram,
  ArchitectureDiagramEdge,
  ArchitectureDiagramNode,
  ArchitectureShapeKind,
  ArchitectureTerminalDockGroup,
} from "@/modules/tabs";
import {
  ApiIcon,
  ArrowRight01Icon,
  ArtificialIntelligence04Icon,
  BoundingBoxIcon,
  Cancel01Icon,
  CircleIcon,
  CloudIcon,
  Cursor01Icon,
  DatabaseIcon,
  DatabaseSyncIcon,
  DeliveryBox01Icon,
  HashtagIcon,
  ImageAdd01Icon,
  LineIcon,
  LockIcon,
  MinusSignIcon,
  PackageIcon,
  PencilEdit01Icon,
  Queue01Icon,
  Router01Icon,
  ServerStackIcon,
  Shield01Icon,
  SquareIcon,
  SquareUnlock01Icon,
  TextIcon,
  TerminalIcon,
  UndoIcon,
  UserIcon,
  WorkflowSquare01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CanvasTerminalNode,
  type CanvasTerminalHandle,
} from "./CanvasTerminalNode";
import { panViewFromPointer } from "./canvasPan";
import { terminalWorldTransform } from "./canvasCoordinates";
import { nextDiagramIdSequence } from "./diagramIds";
import {
  recommendTerminalPlacements,
  type TerminalPlacement,
} from "./terminalPlacement";
import {
  activateTerminalTab,
  detachTerminal,
  dockTerminal,
  layoutTerminalDockDividers,
  layoutTerminalDockGroups,
  normalizeTerminalDockGroups,
  projectTerminalDockLayouts,
  removeTerminalFromDock,
  resolveTerminalDockDrop,
  terminalDockCornerClassName,
  terminalDockGroupUsesSharedHeader,
  terminalDockIndicatorRect,
  TERMINAL_DOCK_GROUP_HEADER_HEIGHT,
  updateTerminalDockSplitRatio,
  updateTerminalGroupBounds,
  type TerminalDockDividerLayout,
  type TerminalDockDropTarget,
  type TerminalDockRect,
  type TerminalDockStackLayout,
} from "./terminalDockLayout";
import type {
  ChangeEvent as ReactChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type ShapeKind = ArchitectureShapeKind;
type CanvasMode = "select" | "pan" | "connect" | "rectangle" | "circle" | "line" | "arrow" | "pen" | "text" | "image" | "terminal" | "frame" | "eraser";
type ShapeDrawingMode =
  | "rectangle"
  | "circle"
  | "line"
  | "arrow"
  | "pen"
  | "text"
  | "image"
  | "frame";
type ResizableShapeKind =
  | "rectangle"
  | "circle"
  | "frame"
  | "text"
  | "image"
  | "terminal";
type ShapeCategory = "Drawing" | "C4" | "Application" | "Data" | "Platform";
type Point = { x: number; y: number };
type ResizeHandle = "nw" | "ne" | "se" | "sw";
type ConnectorHandle = "start" | "control" | "end";

type ArchitectureNode = ArchitectureDiagramNode & {
  rotation?: number;
  connectorStartId?: string;
  connectorEndId?: string;
  textAnchorId?: string;
  frameId?: string;
};
type ArchitectureEdge = ArchitectureDiagramEdge;

type ShapeConfig = {
  kind: ShapeKind;
  label: string;
  category: ShapeCategory;
  description: string;
  icon: typeof WorkflowSquare01Icon;
  tone: string;
  mode?: CanvasMode;
};

type DragState = {
  id: string;
  dx: number;
  dy: number;
  sourceBounds?: TerminalDockRect;
  terminalGroupId?: string;
};

type TerminalDropPreview = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PanState = {
  clientX: number;
  clientY: number;
  viewX: number;
  viewY: number;
};

type DrawingState = {
  id: string;
  kind: ShapeDrawingMode;
  start: Point;
};

type ResizeState = {
  id: string;
  handle: ResizeHandle;
  startNode: ArchitectureNode;
  terminalGroupId?: string;
};

type DockDividerResizeState = {
  divider: TerminalDockDividerLayout;
  start: Point;
  ratio: number;
};

type RotateState = {
  id: string;
  center: Point;
};

type ConnectorHandleState = {
  id: string;
  handle: ConnectorHandle;
};

type HistorySnapshot = {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  nextNode: number;
  nextEdge: number;
};

type Props = {
  active: boolean;
  tabId: number;
  title: string;
  seed?: ArchitectureDiagram;
  onDiagramChange?: (tabId: number, diagram: ArchitectureDiagram) => void;
  onTerminalHandleChange?: (
    tabId: number,
    terminalId: string,
    handle: CanvasTerminalHandle | null,
  ) => void;
  onActiveTerminalChange?: (
    tabId: number,
    terminalId: string | null,
  ) => void;
  canvasFocused?: boolean;
  onToggleCanvasFocus?: () => void;
};

export const ARCHITECTURE_SHAPES: ShapeConfig[] = [
  {
    kind: "rectangle",
    label: "Rectangle",
    category: "Drawing",
    description: "Generic shape, box, note, or container",
    icon: SquareIcon,
    mode: "rectangle",
    tone: "border-zinc-400/35 bg-zinc-500/[0.08] text-zinc-700 dark:text-zinc-200",
  },
  {
    kind: "circle",
    label: "Circle",
    category: "Drawing",
    description: "Round node, state, or compact concept",
    icon: CircleIcon,
    mode: "circle",
    tone: "border-slate-400/35 bg-slate-500/[0.08] text-slate-700 dark:text-slate-200",
  },
  {
    kind: "frame",
    label: "Frame",
    category: "Drawing",
    description: "# frame for grouping areas",
    icon: HashtagIcon,
    mode: "frame",
    tone: "border-neutral-400/35 bg-neutral-500/[0.08] text-neutral-700 dark:text-neutral-200",
  },
  {
    kind: "text",
    label: "Text",
    category: "Drawing",
    description: "T label or annotation",
    icon: TextIcon,
    mode: "text",
    tone: "border-teal-400/35 bg-teal-500/[0.08] text-teal-700 dark:text-teal-200",
  },
  {
    kind: "image",
    label: "Image",
    category: "Drawing",
    description: "Image placeholder with URL or upload",
    icon: ImageAdd01Icon,
    mode: "image",
    tone: "border-pink-400/35 bg-pink-500/[0.08] text-pink-700 dark:text-pink-200",
  },
  {
    kind: "terminal",
    label: "Terminal",
    category: "Platform",
    description: "Independent shell on the canvas",
    icon: TerminalIcon,
    tone: "border-emerald-400/35 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-200",
  },
  {
    kind: "line",
    label: "Line",
    category: "Drawing",
    description: "Free line between points",
    icon: LineIcon,
    mode: "line",
    tone: "border-gray-400/35 bg-gray-500/[0.08] text-gray-700 dark:text-gray-200",
  },
  {
    kind: "arrow",
    label: "Arrow",
    category: "Drawing",
    description: "Directional arrow",
    icon: ArrowRight01Icon,
    mode: "arrow",
    tone: "border-blue-400/35 bg-blue-500/[0.08] text-blue-700 dark:text-blue-200",
  },
  {
    kind: "pen",
    label: "Pen",
    category: "Drawing",
    description: "Freehand drawing",
    icon: PencilEdit01Icon,
    mode: "pen",
    tone: "border-cyan-400/35 bg-cyan-500/[0.08] text-cyan-700 dark:text-cyan-200",
  },
  {
    kind: "actor",
    label: "Actor",
    category: "C4",
    description: "User, team, client, or system persona",
    icon: UserIcon,
    tone: "border-rose-400/35 bg-rose-500/[0.08] text-rose-700 dark:text-rose-200",
  },
  {
    kind: "external",
    label: "External",
    category: "C4",
    description: "Third-party SaaS, partner, or dependency",
    icon: CloudIcon,
    tone: "border-violet-400/35 bg-violet-500/[0.08] text-violet-700 dark:text-violet-200",
  },
  {
    kind: "boundary",
    label: "Boundary",
    category: "C4",
    description: "System, team, zone, or trust boundary",
    icon: BoundingBoxIcon,
    tone: "border-stone-400/35 bg-stone-500/[0.08] text-stone-700 dark:text-stone-200",
  },
  {
    kind: "service",
    label: "Service",
    category: "Application",
    description: "App, backend service, or bounded context",
    icon: WorkflowSquare01Icon,
    tone: "border-sky-400/35 bg-sky-500/[0.08] text-sky-700 dark:text-sky-200",
  },
  {
    kind: "api",
    label: "API",
    category: "Application",
    description: "REST, GraphQL, RPC, or public interface",
    icon: ApiIcon,
    tone: "border-cyan-400/35 bg-cyan-500/[0.08] text-cyan-700 dark:text-cyan-200",
  },
  {
    kind: "worker",
    label: "Worker",
    category: "Application",
    description: "Job processor, consumer, scheduler",
    icon: ServerStackIcon,
    tone: "border-indigo-400/35 bg-indigo-500/[0.08] text-indigo-700 dark:text-indigo-200",
  },
  {
    kind: "function",
    label: "Function",
    category: "Application",
    description: "Serverless function or task handler",
    icon: PackageIcon,
    tone: "border-fuchsia-400/35 bg-fuchsia-500/[0.08] text-fuchsia-700 dark:text-fuchsia-200",
  },
  {
    kind: "ai",
    label: "AI service",
    category: "Application",
    description: "LLM, embedding, agent, or model gateway",
    icon: ArtificialIntelligence04Icon,
    tone: "border-purple-400/35 bg-purple-500/[0.08] text-purple-700 dark:text-purple-200",
  },
  {
    kind: "database",
    label: "Database",
    category: "Data",
    description: "Persistent storage or read model",
    icon: DatabaseIcon,
    tone: "border-emerald-400/35 bg-emerald-500/[0.08] text-emerald-700 dark:text-emerald-200",
  },
  {
    kind: "cache",
    label: "Cache",
    category: "Data",
    description: "Redis, CDN cache, session cache",
    icon: DatabaseSyncIcon,
    tone: "border-lime-400/35 bg-lime-500/[0.08] text-lime-700 dark:text-lime-200",
  },
  {
    kind: "queue",
    label: "Queue",
    category: "Data",
    description: "Event bus, stream, broker, or job queue",
    icon: Queue01Icon,
    tone: "border-amber-400/35 bg-amber-500/[0.10] text-amber-700 dark:text-amber-200",
  },
  {
    kind: "storage",
    label: "Storage",
    category: "Data",
    description: "Blob, bucket, object storage, files",
    icon: DeliveryBox01Icon,
    tone: "border-orange-400/35 bg-orange-500/[0.08] text-orange-700 dark:text-orange-200",
  },
  {
    kind: "gateway",
    label: "Gateway",
    category: "Platform",
    description: "Load balancer, ingress, API gateway",
    icon: Router01Icon,
    tone: "border-blue-400/35 bg-blue-500/[0.08] text-blue-700 dark:text-blue-200",
  },
  {
    kind: "security",
    label: "Security",
    category: "Platform",
    description: "Auth, secrets, policy, trust control",
    icon: Shield01Icon,
    tone: "border-red-400/35 bg-red-500/[0.08] text-red-700 dark:text-red-200",
  },
];
const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 720;
const NODE_WIDTH = 176;
const NODE_HEIGHT = 82;
// Keep a canvas terminal at Cate's native window size. At 55% zoom this still
// leaves enough room for its title bar and real xterm viewport to be usable.
const TERMINAL_DEFAULT_SIZE = { width: 640, height: 400 };
const LEGACY_TERMINAL_SIZE = { width: 420, height: 280 };
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.8;
const MAX_HISTORY = 50;
const CONNECTOR_SNAP_DISTANCE = 28;
const TEXT_ATTACH_DISTANCE = 32;
const CANVAS_PAN_MARGIN_RATIO = 0.75;
const TRACKPAD_PAN_SENSITIVITY = 0.35;
const ARCHITECTURE_TOOL_SHORTCUTS = new Map<string, CanvasMode>([
  ["v", "select"],
  ["h", "pan"],
  ["c", "connect"],
  ["l", "line"],
  ["a", "arrow"],
  ["p", "pen"],
  ["t", "text"],
    ["i", "terminal"],
  ["f", "frame"],
  ["e", "eraser"],
]);
const ARCHITECTURE_TOOL_SHORTCUT_LABELS: Partial<Record<CanvasMode, string>> = {
  select: "V",
  pan: "H",
  connect: "C",
  line: "L",
  arrow: "A",
  pen: "P",
  text: "T",
  image: "I",
  frame: "F",
  eraser: "E",
};

function node(
  id: string,
  kind: ShapeKind,
  label: string,
  technology: string,
  x: number,
  y: number,
  width = defaultSize(kind).width,
  height = defaultSize(kind).height,
  extra: Partial<ArchitectureNode> = {},
): ArchitectureNode {
  return { id, kind, label, technology, x, y, width, height, ...extra };
}

function edge(
  id: string,
  from: string,
  to: string,
  label: string,
): ArchitectureEdge {
  return { id, from, to, label };
}

function shapeFor(kind: ShapeKind): ShapeConfig {
  return ARCHITECTURE_SHAPES.find((shape) => shape.kind === kind)!;
}

function needsTerminalSizeMigration(item: Partial<ArchitectureNode>): boolean {
  if (item.kind !== "terminal" || item.terminalChromeVersion === 2) return false;
  if (item.width === LEGACY_TERMINAL_SIZE.width && item.height === LEGACY_TERMINAL_SIZE.height) {
    return true;
  }
  return typeof item.width === "number" && typeof item.height === "number" && item.width / item.height < 1.2;
}

function normalizeDiagramSeed(seed?: ArchitectureDiagram): {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  terminalDockGroups: ArchitectureTerminalDockGroup[];
} {
  const validKinds = new Set<ShapeKind>(
    ARCHITECTURE_SHAPES.map((shape) => shape.kind),
  );
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const rawNodes = Array.isArray(seed?.nodes) ? seed.nodes : [];
  const rawEdges = Array.isArray(seed?.edges) ? seed.edges : [];
  const isFiniteNumber = (value: unknown): value is number =>
    typeof value === "number" && Number.isFinite(value);

  const nodes = rawNodes.reduce<ArchitectureNode[]>((result, rawNode) => {
    const item = rawNode as Partial<ArchitectureNode>;
    if (
      typeof item.id !== "string" ||
      nodeIds.has(item.id) ||
      typeof item.kind !== "string" ||
      !validKinds.has(item.kind as ShapeKind) ||
      !isFiniteNumber(item.x) ||
      !isFiniteNumber(item.y) ||
      !isFiniteNumber(item.width) ||
      !isFiniteNumber(item.height)
    ) {
      return result;
    }

    nodeIds.add(item.id);
    const isLegacyTerminalSize = needsTerminalSizeMigration(item);
    result.push({
      id: item.id,
      kind: item.kind as ShapeKind,
      label: typeof item.label === "string" ? item.label : "",
      technology: typeof item.technology === "string" ? item.technology : "",
      x: item.x,
      y: item.y,
      width: isLegacyTerminalSize ? TERMINAL_DEFAULT_SIZE.width : item.width,
      height: isLegacyTerminalSize ? TERMINAL_DEFAULT_SIZE.height : item.height,
      ...(isFiniteNumber(item.rotation) ? { rotation: item.rotation } : {}),
      ...(typeof item.locked === "boolean" ? { locked: item.locked } : {}),
      ...(typeof item.imageUrl === "string" ? { imageUrl: item.imageUrl } : {}),
      ...(typeof item.cwd === "string" ? { cwd: item.cwd } : {}),
      ...(typeof item.initialCommand === "string"
        ? { initialCommand: item.initialCommand }
        : {}),
      ...(item.kind === "terminal" ? { terminalChromeVersion: 2 as const } : {}),
      ...(typeof item.connectorStartId === "string"
        ? { connectorStartId: item.connectorStartId }
        : {}),
      ...(typeof item.connectorEndId === "string"
        ? { connectorEndId: item.connectorEndId }
        : {}),
      ...(typeof item.textAnchorId === "string"
        ? { textAnchorId: item.textAnchorId }
        : {}),
      ...(typeof item.frameId === "string" ? { frameId: item.frameId } : {}),
      ...(Array.isArray(item.points)
        ? {
            points: item.points.filter(
              (point): point is Point =>
                isFiniteNumber(point?.x) && isFiniteNumber(point?.y),
            ),
          }
        : {}),
    });
    return result;
  }, []);

  const edges = rawEdges.reduce<ArchitectureEdge[]>((result, rawEdge) => {
    const item = rawEdge as Partial<ArchitectureEdge>;
    if (
      typeof item.id !== "string" ||
      edgeIds.has(item.id) ||
      typeof item.from !== "string" ||
      typeof item.to !== "string" ||
      !nodeIds.has(item.from) ||
      !nodeIds.has(item.to)
    ) {
      return result;
    }

    edgeIds.add(item.id);
    result.push({
      id: item.id,
      from: item.from,
      to: item.to,
      label: typeof item.label === "string" ? item.label : "",
      ...(typeof item.locked === "boolean" ? { locked: item.locked } : {}),
    });
    return result;
  }, []);

  return {
    nodes,
    edges,
    terminalDockGroups: normalizeTerminalDockGroups(
      nodes.filter((item) => item.kind === "terminal"),
      seed?.terminalDockGroups,
    ),
  };
}

export function ArchitectureCanvas({
  active,
  tabId,
  seed,
  onDiagramChange,
  onTerminalHandleChange,
  onActiveTerminalChange,
  canvasFocused = false,
  onToggleCanvasFocus,
}: Props) {
  const appZoom = usePreferencesStore((state) => state.zoomLevel);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const initialDiagram = normalizeDiagramSeed(seed);
  const nextNodeRef = useRef(
    nextDiagramIdSequence(
      initialDiagram.nodes.map((node) => node.id),
      "n",
    ),
  );
  const nextEdgeRef = useRef(
    nextDiagramIdSequence(
      initialDiagram.edges.map((edge) => edge.id),
      "e",
    ),
  );
  const historyRef = useRef<HistorySnapshot[]>([]);
  const [historySize, setHistorySize] = useState(0);
  const [nodes, setNodes] = useState<ArchitectureNode[]>(
    () => initialDiagram.nodes,
  );
  const [edges, setEdges] = useState<ArchitectureEdge[]>(
    () => initialDiagram.edges,
  );
  const [terminalDockGroups, setTerminalDockGroups] = useState<
    ArchitectureTerminalDockGroup[]
  >(() => initialDiagram.terminalDockGroups);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [selectedEdgeId, setSelectedEdgeId] = useState("");
  const [mode, setMode] = useState<CanvasMode>("select");
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [terminalDropPreview, setTerminalDropPreview] =
    useState<TerminalDropPreview | null>(null);
  const [terminalDockDropTarget, setTerminalDockDropTarget] =
    useState<TerminalDockDropTarget | null>(null);
  const [dockDividerResize, setDockDividerResize] =
    useState<DockDividerResizeState | null>(null);
  const dockDividerResizeFrameRef = useRef<number | null>(null);
  const pendingDockDividerRatioRef = useRef<{
    divider: TerminalDockDividerLayout;
    ratio: number;
  } | null>(null);
  const terminalDockDropTargetRef = useRef<TerminalDockDropTarget | null>(null);
  const terminalWorldRef = useRef<HTMLDivElement | null>(null);
  const terminalWorldPromotionTimerRef = useRef<number | null>(null);
  const [pan, setPan] = useState<PanState | null>(null);
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [rotate, setRotate] = useState<RotateState | null>(null);
  const [connectorHandle, setConnectorHandle] =
    useState<ConnectorHandleState | null>(null);
  const [editingTextId, setEditingTextId] = useState("");
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [canvasSize, setCanvasSize] = useState({
    width: VIEWBOX_WIDTH,
    height: VIEWBOX_HEIGHT,
  });
  const [terminalPlacements, setTerminalPlacements] = useState<TerminalPlacement[]>([]);
  const [isFreeTerminalPlacement, setIsFreeTerminalPlacement] = useState(false);
  const [activeTerminalId, setActiveTerminalId] = useState("");
  const [maximizedTerminalId, setMaximizedTerminalId] = useState("");

  const markerId = `architecture-arrow-${tabId}`;
  const frameDotsId = `architecture-frame-dots-${tabId}`;
  const selectedNode = nodes.find((item) => item.id === selectedNodeId) ?? null;
  const selectedEdge = edges.find((item) => item.id === selectedEdgeId) ?? null;
  const selectedLocked = Boolean(selectedNode?.locked || selectedEdge?.locked);
  const nodeById = useMemo(
    () => new Map(nodes.map((item) => [item.id, item])),
    [nodes],
  );
  const viewWidth = canvasSize.width / view.scale;
  const viewHeight = canvasSize.height / view.scale;
  const terminalTransform = terminalWorldTransform(view, appZoom);
  const terminalNodes = nodes.filter((node) => node.kind === "terminal");
  const terminalLayouts = useMemo(
    () => layoutTerminalDockGroups(terminalDockGroups),
    [terminalDockGroups],
  );
  const terminalDockDividers = useMemo(
    () => layoutTerminalDockDividers(terminalDockGroups),
    [terminalDockGroups],
  );
  const terminalLayoutById = useMemo(
    () =>
      new Map(
        terminalLayouts.flatMap((layout) =>
          layout.terminalIds.map((terminalId) => [terminalId, layout] as const),
        ),
      ),
    [terminalLayouts],
  );
  const terminalDockIndicator = terminalDockDropTarget
    ? terminalDockIndicatorRect(terminalDockDropTarget, terminalLayouts)
    : null;
  const terminalResizePaused = Boolean(dockDividerResize || resize?.terminalGroupId);

  // Upgrade the short-lived 420×280 canvas-terminal default even when Vite
  // preserves this component's state during a hot reload.
  useEffect(() => {
    setNodes((current) =>
      current.map((item) =>
        needsTerminalSizeMigration(item)
          ? { ...item, ...TERMINAL_DEFAULT_SIZE, terminalChromeVersion: 2 }
          : item,
      ),
    );
  }, []);

  useEffect(() => {
    onDiagramChange?.(tabId, { nodes, edges, terminalDockGroups });
  }, [edges, nodes, onDiagramChange, tabId, terminalDockGroups]);

  useEffect(() => {
    onActiveTerminalChange?.(tabId, activeTerminalId || null);
  }, [activeTerminalId, onActiveTerminalChange, tabId]);

  useEffect(
    () => () => onActiveTerminalChange?.(tabId, null),
    [onActiveTerminalChange, tabId],
  );

  const selectSingleNode = (id: string) => {
    setSelectedNodeId(id);
    setSelectedNodeIds(id ? [id] : []);
    setSelectedEdgeId("");
  };

  const clearSelection = () => {
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedEdgeId("");
  };

  const updateTerminalDockDropTarget = (
    target: TerminalDockDropTarget | null,
  ) => {
    terminalDockDropTargetRef.current = target;
    setTerminalDockDropTarget(target);
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const updateSize = () => {
      const rect = svg.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      setCanvasSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    };

    updateSize();
    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(updateSize);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setView((current) => clampView(current, current.scale));
  }, [canvasSize.width, canvasSize.height]);

  useEffect(() => {
    terminalWorldPromotionTimerRef.current = window.setTimeout(() => {
      terminalWorldPromotionTimerRef.current = null;
      if (terminalWorldRef.current) {
        terminalWorldRef.current.style.willChange = "auto";
      }
    }, 150);
    return () => {
      if (terminalWorldPromotionTimerRef.current !== null) {
        window.clearTimeout(terminalWorldPromotionTimerRef.current);
      }
    };
  }, []);

  useEffect(
    () => () => {
      if (dockDividerResizeFrameRef.current !== null) {
        cancelAnimationFrame(dockDividerResizeFrameRef.current);
      }
    },
    [],
  );

  const promoteTerminalWorld = () => {
    const terminalWorld = terminalWorldRef.current;
    if (!terminalWorld) return;
    terminalWorld.style.willChange = "transform";
    if (terminalWorldPromotionTimerRef.current !== null) {
      window.clearTimeout(terminalWorldPromotionTimerRef.current);
    }
    terminalWorldPromotionTimerRef.current = window.setTimeout(() => {
      terminalWorldPromotionTimerRef.current = null;
      if (terminalWorldRef.current) {
        terminalWorldRef.current.style.willChange = "auto";
      }
    }, 150);
  };

  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableShortcutTarget(event.target)
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (terminalPlacements.length > 0) {
          setTerminalPlacements([]);
          setIsFreeTerminalPlacement(false);
          return;
        }
        setMode("select");
        setConnectSourceId(null);
        return;
      }

      if (terminalPlacements.length > 0) {
        if (event.key === "Enter") {
          event.preventDefault();
          commitTerminalPlacement(terminalPlacements[0]);
          return;
        }
        if (event.key.toLowerCase() === "f") {
          event.preventDefault();
          setIsFreeTerminalPlacement((current) => !current);
          return;
        }
        const index = Number(event.key) - 1;
        if (Number.isInteger(index) && index >= 0 && index < terminalPlacements.length) {
          event.preventDefault();
          commitTerminalPlacement(terminalPlacements[index]);
        }
        return;
      }

      if (event.shiftKey) return;
      const nextMode = ARCHITECTURE_TOOL_SHORTCUTS.get(
        event.key.toLowerCase(),
      );
      if (!nextMode) return;

      event.preventDefault();
      if (nextMode === "terminal") {
        beginTerminalPlacement();
        return;
      }
      setMode(nextMode);
      setConnectSourceId(nextMode === "connect" ? selectedNodeId || null : null);
      if (nextMode === "connect") setSelectedEdgeId("");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, selectedNodeId, terminalPlacements]);

  const pushHistory = () => {
    const snapshot: HistorySnapshot = {
      nodes: cloneNodes(nodes),
      edges: edges.map((item) => ({ ...item })),
      terminalDockGroups: structuredClone(terminalDockGroups),
      nextNode: nextNodeRef.current,
      nextEdge: nextEdgeRef.current,
    };
    historyRef.current = [...historyRef.current.slice(-MAX_HISTORY + 1), snapshot];
    setHistorySize(historyRef.current.length);
  };

  const undoCanvas = () => {
    const snapshot = historyRef.current.pop();
    if (!snapshot) return;
    setNodes(cloneNodes(snapshot.nodes));
    setEdges(snapshot.edges.map((item) => ({ ...item })));
    setTerminalDockGroups(structuredClone(snapshot.terminalDockGroups));
    nextNodeRef.current = snapshot.nextNode;
    nextEdgeRef.current = snapshot.nextEdge;
    clearSelection();
    setConnectSourceId(null);
    setMode("select");
    setDrag(null);
    setDrawing(null);
    setResize(null);
    setRotate(null);
    setConnectorHandle(null);
    setEditingTextId("");
    setHistorySize(historyRef.current.length);
  };

  useEffect(() => {
    if (!active) return;
    const handleCanvasUndo = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "z" ||
        isEditableShortcutTarget(event.target)
      ) {
        return;
      }
      if (historyRef.current.length === 0) return;
      event.preventDefault();
      undoCanvas();
    };

    window.addEventListener("keydown", handleCanvasUndo);
    return () => window.removeEventListener("keydown", handleCanvasUndo);
  }, [active]);

  const updateTextNodeLabel = (id: string, label: string) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === id ? fitTextNode({ ...node, label }) : node,
      ),
    );
  };

  const removeSelectedNode = () => {
    const targets = selectedNodeIds.length
      ? nodes.filter((item) => selectedNodeIds.includes(item.id) && !item.locked)
      : selectedNode && !selectedNode.locked
        ? [selectedNode]
        : [];
    if (targets.length === 0) return;
    const ids = new Set(targets.map((item) => item.id));
    pushHistory();
    setNodes((current) => current.filter((item) => !ids.has(item.id)));
    setTerminalDockGroups((current) =>
      [...ids].reduce(
        (groups, id) => removeTerminalFromDock(groups, id),
        current,
      ),
    );
    setEdges((current) =>
      current.filter((item) => !ids.has(item.from) && !ids.has(item.to)),
    );
    clearSelection();
    setConnectSourceId(null);
  };

  const removeSelectedEdge = () => {
    if (!selectedEdge || selectedEdge.locked) return;
    eraseEdge(selectedEdge.id);
  };

  useEffect(() => {
    if (!active) return;
    const handleDeleteKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableShortcutTarget(event.target)
      ) {
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (selectedNodeIds.length === 0 && !selectedNode && !selectedEdge) return;

      event.preventDefault();
      if (selectedNode) {
        removeSelectedNode();
        return;
      }
      removeSelectedEdge();
    };

    window.addEventListener("keydown", handleDeleteKey);
    return () => window.removeEventListener("keydown", handleDeleteKey);
  }, [active, selectedNode, selectedEdge]);

  const toggleSelectedLock = () => {
    if (!selectedNode && !selectedEdge) return;
    pushHistory();
    setMode("select");
    if (selectedNode) {
      setNodes((current) =>
        current.map((item) =>
          item.id === selectedNode.id ? { ...item, locked: !item.locked } : item,
        ),
      );
      return;
    }
    if (selectedEdge) {
      setEdges((current) =>
        current.map((item) =>
          item.id === selectedEdge.id ? { ...item, locked: !item.locked } : item,
        ),
      );
    }
  };

  const eraseNode = (id: string) => {
    const target = nodes.find((item) => item.id === id);
    if (!target || target.locked) return;
    pushHistory();
    setNodes((current) => current.filter((item) => item.id !== id));
    setTerminalDockGroups((current) =>
      removeTerminalFromDock(current, id),
    );
    setEdges((current) =>
      current.filter((item) => item.from !== id && item.to !== id),
    );
    clearSelection();
    setConnectSourceId(null);
  };

  const closeTerminalGroup = (group: ArchitectureTerminalDockGroup) => {
    const terminalIds = layoutTerminalDockGroups([group]).flatMap(
      (stack) => stack.terminalIds,
    );
    if (terminalIds.length === 0) return;

    pushHistory();
    setNodes((current) =>
      current.filter((item) => !terminalIds.includes(item.id)),
    );
    setTerminalDockGroups((current) =>
      current.filter((item) => item.id !== group.id),
    );
    setEdges((current) =>
      current.filter(
        (item) =>
          !terminalIds.includes(item.from) &&
          !terminalIds.includes(item.to),
      ),
    );
    if (terminalIds.includes(activeTerminalId)) setActiveTerminalId("");
    if (terminalIds.includes(maximizedTerminalId)) setMaximizedTerminalId("");
    clearSelection();
    setConnectSourceId(null);
  };

  const eraseEdge = (id: string) => {
    const target = edges.find((item) => item.id === id);
    if (!target || target.locked) return;
    pushHistory();
    setEdges((current) => current.filter((item) => item.id !== id));
    setSelectedEdgeId("");
  };

  const connectNodes = (targetId: string) => {
    if (!connectSourceId) {
      setConnectSourceId(targetId);
      selectSingleNode(targetId);
      return;
    }
    if (connectSourceId === targetId) return;
    const existing = edges.find(
      (item) => item.from === connectSourceId && item.to === targetId,
    );
    if (existing) {
      setSelectedEdgeId(existing.id);
      setSelectedNodeId("");
      setSelectedNodeIds([]);
    } else {
      pushHistory();
      const id = `e${nextEdgeRef.current++}`;
      setEdges((current) => [
        ...current,
        edge(id, connectSourceId, targetId, "calls"),
      ]);
      setSelectedEdgeId(id);
      setSelectedNodeId("");
      setSelectedNodeIds([]);
    }
    setConnectSourceId(null);
    setMode("select");
  };

  const handleNodePointerDown = (
    event: ReactPointerEvent<SVGGElement>,
    item: ArchitectureNode,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (mode === "eraser") {
      eraseNode(item.id);
      return;
    }
    if (mode === "connect") {
      connectNodes(item.id);
      return;
    }
    if (mode === "pan") {
      startPan(event);
      return;
    }
    if (event.shiftKey) {
      setSelectedEdgeId("");
      setSelectedNodeIds((current) => {
        const next = current.includes(item.id)
          ? current.filter((id) => id !== item.id)
          : [...current, item.id];
        setSelectedNodeId(next[next.length - 1] ?? "");
        return next;
      });
      return;
    }
    if (!selectedNodeIds.includes(item.id)) {
      selectSingleNode(item.id);
    }
    if (item.locked || isFreehandKind(item.kind)) return;
    const point = svgPoint(event);
    pushHistory();
    setTerminalDropPreview(null);
    updateTerminalDockDropTarget(null);
    const sourceBounds =
      item.kind === "terminal"
        ? terminalLayoutById.get(item.id)?.rect
        : undefined;
    setDrag({
      id: item.id,
      dx: point.x - (sourceBounds?.x ?? item.x),
      dy: point.y - (sourceBounds?.y ?? item.y),
      ...(sourceBounds ? { sourceBounds } : {}),
    });
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const handleTerminalGroupHeaderPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    group: ArchitectureTerminalDockGroup,
    activeTerminalNode: ArchitectureNode,
    locked: boolean,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (mode !== "select") {
      handleNodePointerDown(
        event as unknown as ReactPointerEvent<SVGGElement>,
        activeTerminalNode,
      );
      return;
    }
    if (!selectedNodeIds.includes(activeTerminalNode.id)) {
      selectSingleNode(activeTerminalNode.id);
    }
    if (locked) return;

    const point = svgPoint(event);
    pushHistory();
    setTerminalDropPreview(null);
    updateTerminalDockDropTarget(null);
    setDrag({
      id: activeTerminalNode.id,
      dx: point.x - group.x,
      dy: point.y - group.y,
      sourceBounds: group,
      terminalGroupId: group.id,
    });
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const handleResizePointerDown = (
    event: ReactPointerEvent<SVGRectElement>,
    item: ArchitectureNode,
    handle: ResizeHandle,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (item.locked || !isResizableShapeKind(item.kind)) return;
    pushHistory();
    selectSingleNode(item.id);
    setConnectSourceId(null);
    setDrag(null);
    setDrawing(null);
    setRotate(null);
    setConnectorHandle(null);
    const terminalLayout =
      item.kind === "terminal" ? terminalLayoutById.get(item.id) : undefined;
    const terminalGroup = terminalLayout
      ? terminalDockGroups.find(
          (group) => group.id === terminalLayout.groupId,
        )
      : undefined;
    setResize({
      id: item.id,
      handle,
      startNode: terminalGroup
        ? {
            ...cloneNode(item),
            x: terminalGroup.x,
            y: terminalGroup.y,
            width: terminalGroup.width,
            height: terminalGroup.height,
          }
        : cloneNode(item),
      ...(terminalGroup ? { terminalGroupId: terminalGroup.id } : {}),
    });
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const commitDockDividerRatio = (
    divider: TerminalDockDividerLayout,
    ratio: number,
  ) => {
    setTerminalDockGroups((current) =>
      updateTerminalDockSplitRatio(
        current,
        divider.groupId,
        divider.splitId,
        ratio,
      ),
    );
  };

  const flushDockDividerResize = () => {
    const pending = pendingDockDividerRatioRef.current;
    pendingDockDividerRatioRef.current = null;
    if (!pending) return;
    commitDockDividerRatio(pending.divider, pending.ratio);
  };

  const updateDockDividerRatio = (
    divider: TerminalDockDividerLayout,
    ratio: number,
  ) => {
    pendingDockDividerRatioRef.current = { divider, ratio };
    if (dockDividerResizeFrameRef.current !== null) return;
    dockDividerResizeFrameRef.current = requestAnimationFrame(() => {
      dockDividerResizeFrameRef.current = null;
      flushDockDividerResize();
    });
  };

  const handleDockDividerPointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    pushHistory();
    setDrag(null);
    setDrawing(null);
    setResize(null);
    setRotate(null);
    setConnectorHandle(null);
    setDockDividerResize({
      divider,
      start: svgPointFromClient(event),
      ratio: divider.ratio,
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDockDividerPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
  ) => {
    const resizing = dockDividerResize;
    if (
      !resizing ||
      resizing.divider.groupId !== divider.groupId ||
      resizing.divider.splitId !== divider.splitId
    ) {
      return;
    }
    const point = svgPointFromClient(event);
    const axisDelta =
      divider.direction === "horizontal"
        ? point.x - resizing.start.x
        : point.y - resizing.start.y;
    const axisLength =
      divider.direction === "horizontal"
        ? resizing.divider.rect.width
        : resizing.divider.rect.height;
    if (axisLength <= 0) return;
    updateDockDividerRatio(
      divider,
      clamp(resizing.ratio + axisDelta / axisLength, 0.1, 0.9),
    );
  };

  const finishDockDividerResize = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (dockDividerResizeFrameRef.current !== null) {
      cancelAnimationFrame(dockDividerResizeFrameRef.current);
      dockDividerResizeFrameRef.current = null;
    }
    flushDockDividerResize();
    setDockDividerResize(null);
  };

  const handleDockDividerKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
  ) => {
    const step = event.shiftKey ? 0.1 : 0.05;
    const delta =
      divider.direction === "horizontal"
        ? event.key === "ArrowLeft"
          ? -step
          : event.key === "ArrowRight"
            ? step
            : null
        : event.key === "ArrowUp"
          ? -step
          : event.key === "ArrowDown"
            ? step
            : null;
    if (delta === null) return;
    event.preventDefault();
    event.stopPropagation();
    pushHistory();
    updateDockDividerRatio(divider, clamp(divider.ratio + delta, 0.1, 0.9));
  };

  const handleRotatePointerDown = (
    event: ReactPointerEvent<SVGCircleElement>,
    item: ArchitectureNode,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (item.locked || !isResizableShapeKind(item.kind)) return;
    pushHistory();
    selectSingleNode(item.id);
    setConnectSourceId(null);
    setDrag(null);
    setDrawing(null);
    setResize(null);
    setConnectorHandle(null);
    setRotate({
      id: item.id,
      center: {
        x: item.x + item.width / 2,
        y: item.y + item.height / 2,
      },
    });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleConnectorPointerDown = (
    event: ReactPointerEvent<SVGCircleElement>,
    item: ArchitectureNode,
    handle: ConnectorHandle,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (item.locked || !isConnectorKind(item.kind)) return;
    pushHistory();
    selectSingleNode(item.id);
    setConnectSourceId(null);
    setDrag(null);
    setDrawing(null);
    setResize(null);
    setRotate(null);
    setConnectorHandle({ id: item.id, handle });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleEdgePointerDown = (
    event: ReactPointerEvent<SVGGElement>,
    edgeId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (mode === "eraser") {
      eraseEdge(edgeId);
      return;
    }
    setSelectedEdgeId(edgeId);
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setConnectSourceId(null);
  };

  const handleNodeDoubleClick = (
    event: ReactMouseEvent<SVGGElement>,
    item: ArchitectureNode,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (item.kind !== "text" || item.locked) return;
    pushHistory();
    selectSingleNode(item.id);
    setConnectSourceId(null);
    setMode("select");
    setEditingTextId(item.id);
  };

  const handleCanvasDoubleClick = (
    event: ReactMouseEvent<SVGSVGElement>,
  ) => {
    if (isEditableShortcutTarget(event.target)) return;
    event.preventDefault();
    const point = svgPointFromClient(event);
    pushHistory();
    const created = {
      ...createNode("text", point),
      label: "",
    };
    setNodes((current) => [...current, created]);
    selectSingleNode(created.id);
    setConnectSourceId(null);
    setMode("select");
    setEditingTextId(created.id);
  };

  const handleCanvasPointerDown = (
    event: ReactPointerEvent<SVGSVGElement>,
  ) => {
    if (mode === "pan") {
      startPan(event);
      return;
    }

    const point = svgPoint(event);
    if (terminalPlacements.length > 0) {
      if (isFreeTerminalPlacement) {
        commitFreeTerminalPlacement(point);
      } else {
        setTerminalPlacements([]);
      }
      setIsFreeTerminalPlacement(false);
      return;
    }
    if (mode === "terminal") {
      beginTerminalPlacement();
      return;
    }
    if (isShapeDrawingMode(mode)) {
      pushHistory();
      const created = createNode(mode, point, true);
      setNodes((current) => [...current, created]);
      setDrawing({ id: created.id, kind: mode, start: point });
      selectSingleNode(created.id);
      setConnectSourceId(null);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    clearSelection();
    if (mode === "connect") setConnectSourceId(null);
  };

  const startPan = (event: ReactPointerEvent) => {
    setPan({
      clientX: event.clientX,
      clientY: event.clientY,
      viewX: view.x,
      viewY: view.y,
    });
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pan) {
      setView((current) => ({
        ...clampView(
          {
            ...current,
            ...panViewFromPointer(pan, event, current.scale),
          },
          current.scale,
        ),
      }));
      return;
    }

    if (drawing) {
      const point = svgPoint(event);
      setNodes((current) =>
        current.map((item) =>
          item.id === drawing.id
            ? updateDrawingNode(item, drawing, point, current)
            : item,
        ),
      );
      return;
    }

    if (resize) {
      const point = svgPoint(event);
      if (resize.terminalGroupId) {
        const terminalGroupId = resize.terminalGroupId;
        const resized = updateResizedNode(
          resize.startNode,
          resize,
          point,
        );
        setTerminalDockGroups((current) =>
          updateTerminalGroupBounds(
            current,
            terminalGroupId,
            {
              x: resized.x,
              y: resized.y,
              width: resized.width,
              height: resized.height,
            },
          ),
        );
        return;
      }
      setNodes((current) =>
        current.map((item) =>
          item.id === resize.id && !item.locked
            ? updateResizedNode(item, resize, point)
            : item,
        ),
      );
      return;
    }

    if (rotate) {
      const point = svgPoint(event);
      setNodes((current) =>
        current.map((item) =>
          item.id === rotate.id && !item.locked
            ? updateRotatingNode(item, rotate, point)
            : item,
        ),
      );
      return;
    }

    if (connectorHandle) {
      const point = svgPoint(event);
      setNodes((current) =>
        current.map((item) =>
          item.id === connectorHandle.id && !item.locked
            ? updateConnectorHandle(item, connectorHandle, point, current)
            : item,
        ),
      );
      return;
    }

    if (!drag) return;
    const point = svgPoint(event);
    const bounds = drawableBounds();
    const dragged = nodes.find((item) => item.id === drag.id);
    const terminalGroupId = drag.terminalGroupId;
    if (terminalGroupId) {
      if (!dragged) return;
      const nextBounds = draggedNodeAtPoint(dragged, drag, point, bounds);
      setTerminalDockGroups((current) =>
        updateTerminalGroupBounds(current, terminalGroupId, nextBounds),
      );
      const terminalGroup = terminalDockGroups.find(
        (group) => group.id === terminalGroupId,
      );
      const isSingleTerminalGroup = terminalGroup
        ? !terminalDockGroupUsesSharedHeader(terminalGroup)
        : false;
      if (isSingleTerminalGroup) {
        setTerminalDropPreview({ id: dragged.id, ...nextBounds });
        const svgRect = svgRef.current?.getBoundingClientRect();
        if (svgRect) {
          const clientLayouts = projectTerminalDockLayouts(
            terminalLayouts,
            { x: view.x, y: view.y, width: viewWidth, height: viewHeight },
            {
              x: svgRect.left,
              y: svgRect.top,
              width: svgRect.width,
              height: svgRect.height,
            },
          );
          updateTerminalDockDropTarget(
            resolveTerminalDockDrop(
              { x: event.clientX, y: event.clientY },
              clientLayouts,
              dragged.id,
            ),
          );
        }
      }
      return;
    }
    if (dragged?.kind === "terminal") {
      const nextBounds = draggedNodeAtPoint(dragged, drag, point, bounds);
      const svgRect = svgRef.current?.getBoundingClientRect();
      setTerminalDropPreview({
        id: dragged.id,
        ...nextBounds,
      });
      if (svgRect) {
        const clientLayouts = projectTerminalDockLayouts(
          terminalLayouts,
          { x: view.x, y: view.y, width: viewWidth, height: viewHeight },
          {
            x: svgRect.left,
            y: svgRect.top,
            width: svgRect.width,
            height: svgRect.height,
          },
        );
        updateTerminalDockDropTarget(
          resolveTerminalDockDrop(
            { x: event.clientX, y: event.clientY },
            clientLayouts,
            dragged.id,
          ),
        );
      }
      return;
    }
    setNodes((current) =>
      updateDraggedNodes(current, drag, point, bounds, selectedNodeIds),
    );
  };

  const handlePointerEnd = () => {
    if (drawing && drawing.kind !== "pen") {
      setMode("select");
    }
    if (drag && terminalDropPreview?.id === drag.id) {
      const dragged = nodes.find((item) => item.id === drag.id);
      const dockTarget = terminalDockDropTargetRef.current;
      if (dragged?.kind === "terminal" && dockTarget) {
        const targetStack = terminalLayouts.find(
          (layout) =>
            layout.groupId === dockTarget.groupId &&
            layout.stackId === dockTarget.stackId,
        );
        const targetTerminal = targetStack
          ? nodes.find((item) => item.id === targetStack.activeTerminalId)
          : null;
        setTerminalDockGroups((current) =>
          normalizeTerminalDockGroups(
            nodes.filter((item) => item.kind === "terminal"),
            dockTerminal(current, dragged.id, dockTarget),
          ),
        );
        if (targetTerminal) {
          setNodes((current) =>
            current.map((item) =>
              item.id === dragged.id
                ? { ...item, frameId: targetTerminal.frameId }
                : item,
            ),
          );
        }
      } else if (!drag.terminalGroupId) {
        const point = {
          x: terminalDropPreview.x + drag.dx,
          y: terminalDropPreview.y + drag.dy,
        };
        setNodes((current) =>
          updateDraggedNodes(
            current,
            drag,
            point,
            drawableBounds(),
            selectedNodeIds,
          ),
        );
        if (dragged?.kind === "terminal") {
          setTerminalDockGroups((current) =>
            detachTerminal(current, dragged.id, terminalDropPreview),
          );
        }
      }
    }
    setDrag(null);
    setTerminalDropPreview(null);
    updateTerminalDockDropTarget(null);
    setPan(null);
    setDrawing(null);
    setResize(null);
    setRotate(null);
    setConnectorHandle(null);
  };

  const handleCanvasWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    promoteTerminalWorld();
    if (!event.ctrlKey && !event.metaKey) {
      const delta = wheelPanDelta(event);
      setView((current) =>
        clampView(
          {
            ...current,
            x: current.x + delta.x / current.scale,
            y: current.y + delta.y / current.scale,
          },
          current.scale,
        ),
      );
      return;
    }
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localX = (event.clientX - rect.left) / Math.max(rect.width, 1);
    const localY = (event.clientY - rect.top) / Math.max(rect.height, 1);

    setView((current) => {
      const currentWidth = canvasSize.width / current.scale;
      const currentHeight = canvasSize.height / current.scale;
      const focal = {
        x: current.x + localX * currentWidth,
        y: current.y + localY * currentHeight,
      };
      const nextScale = clamp(
        current.scale * Math.exp(-event.deltaY * 0.002),
        MIN_ZOOM,
        MAX_ZOOM,
      );
      const nextWidth = canvasSize.width / nextScale;
      const nextHeight = canvasSize.height / nextScale;
      return clampView(
        {
          scale: nextScale,
          x: focal.x - localX * nextWidth,
          y: focal.y - localY * nextHeight,
        },
        nextScale,
      );
    });
  };

  const zoomBy = (delta: number) => {
    promoteTerminalWorld();
    setView((current) => {
      const nextScale = clamp(current.scale + delta, MIN_ZOOM, MAX_ZOOM);
      return centeredView(current, nextScale);
    });
  };

  function createNode(
    kind: ShapeKind,
    point: Point,
    fromDrag = false,
  ): ArchitectureNode {
    const size = defaultSize(kind);
    const id = `n${nextNodeRef.current++}`;
    const bounds = drawableBounds();
    const x = clamp(
      point.x - size.width / 2,
      bounds.x + 16,
      bounds.x + bounds.width - size.width - 16,
    );
    const y = clamp(
      point.y - size.height / 2,
      bounds.y + 16,
      bounds.y + bounds.height - size.height - 16,
    );
    if (kind === "line" || kind === "arrow") {
      return node(id, kind, shapeFor(kind).label, "", point.x, point.y, 1, 1);
    }
    if (kind === "pen") {
      return node(id, kind, "Pen", "", point.x, point.y, 1, 1, {
        points: [{ x: 0, y: 0 }],
      });
    }
    if (fromDrag && isResizableShapeKind(kind)) {
      const minimum = minimumDrawingSize(kind);
      return node(
        id,
        kind,
        shapeFor(kind).label,
        defaultTechnology(kind),
        point.x,
        point.y,
        minimum.width,
        minimum.height,
      );
    }
    return node(
      id,
      kind,
      shapeFor(kind).label,
      defaultTechnology(kind),
      x,
      y,
      undefined,
      undefined,
      kind === "terminal" ? { terminalChromeVersion: 2 } : {},
    );
  }

  function beginTerminalPlacement() {
    const activeTerminal = terminalNodes.find((node) => node.id === activeTerminalId);
    const nearestTerminal = terminalNodes.reduce<ArchitectureNode | null>((nearest, node) => {
      const viewportCenter = { x: view.x + viewWidth / 2, y: view.y + viewHeight / 2 };
      if (!nearest) return node;
      return distance(nodeCenter(node), viewportCenter) < distance(nodeCenter(nearest), viewportCenter)
        ? node
        : nearest;
    }, null);
    const focusNode =
      activeTerminal ??
      (selectedNode?.kind === "terminal" ? selectedNode : null) ??
      nearestTerminal;
    const anchor = focusNode
      ? {
          x: focusNode.x,
          y: focusNode.y,
          width: focusNode.width,
          height: focusNode.height,
        }
      : undefined;
    if (anchor) setView((current) => centerViewOnPlacement(current, anchor));
    clearSelection();
    setConnectSourceId(null);
    setMode("select");
    setIsFreeTerminalPlacement(false);
    setTerminalPlacements(
      recommendTerminalPlacements(
        { x: view.x, y: view.y, width: viewWidth, height: viewHeight },
        nodes.map(({ x, y, width, height }) => ({ x, y, width, height })),
        anchor,
      ),
    );
  }

  function inheritedTerminalCwd(): string | undefined {
    return (
      terminalNodes.find((node) => node.id === activeTerminalId)?.cwd ??
      (selectedNode?.kind === "terminal" ? selectedNode.cwd : undefined) ??
      terminalNodes[0]?.cwd
    );
  }

  function createDockedTerminal(
    target: Pick<TerminalDockStackLayout, "groupId" | "stackId" | "rect">,
    kind: "tab" | "split",
    source: ArchitectureNode,
  ) {
    pushHistory();
    const created = node(
      `n${nextNodeRef.current++}`,
      "terminal",
      shapeFor("terminal").label,
      defaultTechnology("terminal"),
      target.rect.x,
      target.rect.y,
      target.rect.width,
      target.rect.height,
      {
        terminalChromeVersion: 2,
        ...(source.cwd ? { cwd: source.cwd } : {}),
        ...(source.frameId ? { frameId: source.frameId } : {}),
      },
    );

    setNodes((current) => [...current, created]);
    setTerminalDockGroups((current) =>
      dockTerminal(
        [...current, ...normalizeTerminalDockGroups([created], undefined)],
        created.id,
        kind === "tab"
          ? {
              kind: "tab",
              groupId: target.groupId,
              stackId: target.stackId,
            }
          : {
              kind: "split",
              groupId: target.groupId,
              stackId: target.stackId,
              edge: "right",
            },
      ),
    );
    setActiveTerminalId(created.id);
    selectSingleNode(created.id);
  }

  function commitTerminalPlacement(placement: TerminalPlacement) {
    pushHistory();
    const created = node(
      `n${nextNodeRef.current++}`,
      "terminal",
      shapeFor("terminal").label,
      defaultTechnology("terminal"),
      placement.x,
      placement.y,
      placement.width,
      placement.height,
      {
        terminalChromeVersion: 2,
        ...(inheritedTerminalCwd()
          ? { cwd: inheritedTerminalCwd() }
          : {}),
      },
    );
    setNodes((current) => [...current, created]);
    setTerminalDockGroups((current) => [
      ...current,
      ...normalizeTerminalDockGroups([created], undefined),
    ]);
    selectSingleNode(created.id);
    setActiveTerminalId(created.id);
    setView((current) => centerViewOnPlacement(current, created));
    setTerminalPlacements([]);
    setIsFreeTerminalPlacement(false);
  }

  function commitFreeTerminalPlacement(point: Point) {
    pushHistory();
    const created = {
      ...createNode("terminal", point),
      ...(inheritedTerminalCwd()
        ? { cwd: inheritedTerminalCwd() }
        : {}),
    };
    setNodes((current) => [...current, created]);
    setTerminalDockGroups((current) => [
      ...current,
      ...normalizeTerminalDockGroups([created], undefined),
    ]);
    selectSingleNode(created.id);
    setActiveTerminalId(created.id);
    setView((current) => centerViewOnPlacement(current, created));
    setTerminalPlacements([]);
  }

  function svgPoint(event: ReactPointerEvent): Point {
    return svgPointFromClient(event);
  }

  function svgPointFromClient(event: { clientX: number; clientY: number }): Point {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: view.x + ((event.clientX - rect.left) / Math.max(rect.width, 1)) * viewWidth,
      y: view.y + ((event.clientY - rect.top) / Math.max(rect.height, 1)) * viewHeight,
    };
  }

  function centeredView(current: typeof view, scale: number): typeof view {
    const centerX = current.x + canvasSize.width / current.scale / 2;
    const centerY = current.y + canvasSize.height / current.scale / 2;
    const width = canvasSize.width / scale;
    const height = canvasSize.height / scale;
    return clampView({
      scale,
      x: centerX - width / 2,
      y: centerY - height / 2,
    }, scale);
  }

  function centerViewOnPlacement(
    current: typeof view,
    placement: TerminalPlacement,
  ): typeof view {
    const width = canvasSize.width / current.scale;
    const height = canvasSize.height / current.scale;
    return clampView(
      {
        ...current,
        x: placement.x + placement.width / 2 - width / 2,
        y: placement.y + placement.height / 2 - height / 2,
      },
      current.scale,
    );
  }

  function clampView(current: typeof view, scale: number): typeof view {
    const width = canvasSize.width / scale;
    const height = canvasSize.height / scale;
    return {
      scale,
      x: clampViewCoord(current.x, width, VIEWBOX_WIDTH),
      y: clampViewCoord(current.y, height, VIEWBOX_HEIGHT),
    };
  }

  function clampViewCoord(
    value: number,
    viewportSize: number,
    canvasSize: number,
  ): number {
    const slack = viewportSize * CANVAS_PAN_MARGIN_RATIO;
    const min = -slack;
    const max = Math.max(canvasSize - viewportSize, 0) + slack;
    return clamp(value, min, max);
  }

  function drawableBounds(): { x: number; y: number; width: number; height: number } {
    const x = Math.min(0, view.x);
    const y = Math.min(0, view.y);
    return {
      x,
      y,
      width: Math.max(VIEWBOX_WIDTH, view.x + viewWidth) - x,
      height: Math.max(VIEWBOX_HEIGHT, view.y + viewHeight) - y,
    };
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-background text-foreground">
      <div className="absolute bottom-6 left-1/2 z-20 flex min-h-16 max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-[2.5rem] border border-zinc-300/90 bg-white/95 px-3 py-2 text-zinc-800 shadow-[0_10px_28px_rgba(15,23,42,0.15)] backdrop-blur-xl transition-all duration-200 motion-reduce:transition-none">
          <ToolButton
            active={mode === "select"}
            icon={Cursor01Icon}
            label="Select"
            shortcut={ARCHITECTURE_TOOL_SHORTCUT_LABELS.select}
            onClick={() => {
              setMode("select");
              setConnectSourceId(null);
            }}
          />
          <ToolButton
            active={mode === "pan"}
            iconNode={<PanToolIcon />}
            label="Pan"
            shortcut={ARCHITECTURE_TOOL_SHORTCUT_LABELS.pan}
            onClick={() => {
              setMode("pan");
              setConnectSourceId(null);
            }}
          />
          <ToolButton
            active={mode === "line"}
            icon={MinusSignIcon}
            label="Line"
            shortcut={ARCHITECTURE_TOOL_SHORTCUT_LABELS.line}
            onClick={() => setMode("line")}
          />
          <ToolButton
            active={mode === "pen"}
            icon={PencilEdit01Icon}
            label="Pen"
            shortcut={ARCHITECTURE_TOOL_SHORTCUT_LABELS.pen}
            onClick={() => setMode("pen")}
          />
          <ToolButton
            active={mode === "text"}
            icon={TextIcon}
            label="Text"
            shortcut={ARCHITECTURE_TOOL_SHORTCUT_LABELS.text}
            onClick={() => setMode("text")}
          />
          <ToolButton
            active={terminalPlacements.length > 0}
            icon={TerminalIcon}
            label="Add terminal"
            shortcut={ARCHITECTURE_TOOL_SHORTCUT_LABELS.image}
            onClick={beginTerminalPlacement}
          />
          <ToolButton
            active={mode === "frame"}
            icon={HashtagIcon}
            label="Frame"
            shortcut={ARCHITECTURE_TOOL_SHORTCUT_LABELS.frame}
            onClick={() => setMode("frame")}
          />
          <ToolButton
            active={selectedLocked}
            disabled={!selectedNode && !selectedEdge}
            icon={selectedLocked ? SquareUnlock01Icon : LockIcon}
            label={selectedLocked ? "Unlock" : "Lock"}
            onClick={toggleSelectedLock}
          />
          <ToolButton
            disabled={historySize === 0}
            icon={UndoIcon}
            label="Undo"
            onClick={undoCanvas}
          />
          <span aria-hidden="true" className="mx-1 h-8 w-px shrink-0 bg-zinc-200" />
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="h-11 w-11 shrink-0 rounded-full text-3xl font-normal text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            title="Zoom out"
            aria-label="Zoom out"
            onClick={() => zoomBy(-0.15)}
          >
            −
          </Button>
          <span
            aria-label={`Current zoom: ${Math.round(view.scale * 100)}%`}
            className="min-w-14 shrink-0 text-center text-base font-medium tabular-nums text-zinc-700"
          >
            {Math.round(view.scale * 100)}%
          </span>
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            className="h-11 w-11 shrink-0 rounded-full text-3xl font-normal text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            title="Zoom in"
            aria-label="Zoom in"
            onClick={() => zoomBy(0.15)}
          >
            +
          </Button>
      </div>

      <div className="min-h-0 flex-1">
      <main className="relative h-full min-h-0 overflow-hidden bg-[#fbfdfc]">
          <svg
            ref={svgRef}
            xmlns="http://www.w3.org/2000/svg"
            viewBox={`${view.x} ${view.y} ${viewWidth} ${viewHeight}`}
            preserveAspectRatio="none"
            className={cn(
              "block h-full w-full",
              mode === "pan" && "cursor-grab active:cursor-grabbing",
              mode === "eraser" && "cursor-cell",
              isShapeDrawingMode(mode) && "cursor-crosshair",
            )}
            role="img"
            aria-label="Architecture diagram canvas"
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerLeave={handlePointerEnd}
            onPointerDown={handleCanvasPointerDown}
            onDoubleClick={handleCanvasDoubleClick}
            onWheel={handleCanvasWheel}
          >
            <defs>
              <pattern
                id={`architecture-grid-${tabId}`}
                width="24"
                height="24"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 24 0 L 0 0 0 24"
                  fill="none"
                  stroke="#dbe7e4"
                  strokeOpacity="0.72"
                  strokeWidth="1"
                />
              </pattern>
              <pattern
                id={frameDotsId}
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="4" cy="4" r="1.8" fill="currentColor" opacity="0.22" />
              </pattern>
              <marker
                id={markerId}
                markerWidth="10"
                markerHeight="10"
                refX="8"
                refY="5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
              </marker>
            </defs>
            <rect
              x={view.x}
              y={view.y}
              width={viewWidth}
              height={viewHeight}
              fill={`url(#architecture-grid-${tabId})`}
            />

            {edges.map((item) => {
              const from = nodeById.get(item.from);
              const to = nodeById.get(item.to);
              if (!from || !to) return null;
              const start = edgeAnchorPoint(from, to, false);
              const end = edgeAnchorPoint(to, from, true);
              const midX = (start.x + end.x) / 2;
              const midY = (start.y + end.y) / 2;
              const selected = item.id === selectedEdgeId;
              return (
                <g
                  key={item.id}
                  className={cn(
                    "cursor-pointer",
                    selected ? "text-primary" : "text-foreground/55",
                    item.locked && "text-muted-foreground/50",
                  )}
                  onPointerDown={(event) => handleEdgePointerDown(event, item.id)}
                >
                  <path
                    d={`M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="14"
                  />
                  <path
                    d={`M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`}
                    fill="none"
                    stroke="currentColor"
                    strokeDasharray={item.locked ? "6 5" : undefined}
                    strokeWidth={selected ? 3 : 2}
                    markerEnd={`url(#${markerId})`}
                  />
                  {item.label ? (
                    <g>
                      <rect
                        x={midX - Math.max(36, item.label.length * 3.2)}
                        y={midY - 19}
                        width={Math.max(72, item.label.length * 6.4)}
                        height="18"
                        rx="9"
                        className="fill-background stroke-border"
                      />
                      <text
                        x={midX}
                        y={midY - 6}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[11px]"
                      >
                        {item.label}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })}

            {nodes.map((item) => {
              const displayNode = resolveConnectorNode(item, nodes);
              return (
                <DiagramNode
                  key={item.id}
                  markerId={markerId}
                  node={displayNode}
                  frameDotsId={frameDotsId}
                  selected={selectedNodeIds.includes(item.id)}
                  editing={item.id === editingTextId}
                  pendingConnect={item.id === connectSourceId}
                  onPointerDown={(event) => handleNodePointerDown(event, item)}
                  onDoubleClick={(event) => handleNodeDoubleClick(event, item)}
                  onTextChange={(label) => updateTextNodeLabel(item.id, label)}
                  onTextEditEnd={() => setEditingTextId("")}
                  onResizePointerDown={handleResizePointerDown}
                  onRotatePointerDown={handleRotatePointerDown}
                  onConnectorPointerDown={(event, _node, handle) =>
                    handleConnectorPointerDown(event, item, handle)
                  }
                />
              );
            })}
          </svg>

          <div className="pointer-events-none absolute inset-0">
            {/* Keep terminal boxes in canvas-space and move the whole layer.
                CSS transforms do not trigger ResizeObserver, so xterm does not
                fit and resize its PTY on every camera zoom tick. */}
            <div
              ref={terminalWorldRef}
              data-canvas-terminal-world="true"
              className="absolute left-0 top-0 h-0 w-0"
              style={{
                transform: `translate3d(${terminalTransform.translateX}px, ${terminalTransform.translateY}px, 0) scale(${terminalTransform.scale})`,
                transformOrigin: "0 0",
                willChange: "transform",
              }}
            >
              {terminalDockGroups.map((group) => {
                const groupLayouts = terminalLayouts.filter(
                  (layout) => layout.groupId === group.id,
                );
                const terminalIds = groupLayouts.flatMap(
                  (layout) => layout.terminalIds,
                );
                const maximizedTerminal = terminalIds.find(
                  (terminalId) => terminalId === maximizedTerminalId,
                );
                if (!active || (maximizedTerminalId && !maximizedTerminal)) {
                  return null;
                }
                if (!terminalDockGroupUsesSharedHeader(group)) {
                  return null;
                }

                const activeTerminal = terminalIds.includes(activeTerminalId)
                  ? activeTerminalId
                  : groupLayouts[0]?.activeTerminalId ?? terminalIds[0];
                const activeTerminalNode = activeTerminal
                  ? nodeById.get(activeTerminal)
                  : undefined;
                if (!activeTerminal || !activeTerminalNode) return null;

                const locked = terminalIds.every(
                  (terminalId) => Boolean(nodeById.get(terminalId)?.locked),
                );
                const bounds = maximizedTerminal
                  ? {
                      x: view.x + 32,
                      y: view.y + 32,
                      width: Math.max(320, viewWidth - 64),
                      height: Math.max(200, viewHeight - 64),
                    }
                  : group;

                return (
                  <div
                    key={group.id}
                    data-canvas-terminal-group-header="true"
                    className="pointer-events-auto absolute z-30 flex h-7 items-center rounded-t-[12px] border-b border-border/60 bg-white/95 text-muted-foreground shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/95 dark:text-zinc-300"
                    style={{
                      left: `${bounds.x}px`,
                      top: `${bounds.y}px`,
                      width: `${bounds.width}px`,
                    }}
                    onPointerDown={(event) => {
                      if ((event.target as HTMLElement).closest("button")) return;
                      if (maximizedTerminal) {
                        event.preventDefault();
                        event.stopPropagation();
                        setMaximizedTerminalId("");
                        return;
                      }
                      handleTerminalGroupHeaderPointerDown(
                        event,
                        group,
                        activeTerminalNode,
                        locked,
                      );
                    }}
                  >
                    <span className="min-w-0 flex-1" />
                    <div className="flex shrink-0 items-center gap-0.5 px-1">
                      <button
                        type="button"
                        aria-label={locked ? "Unlock terminal group" : "Lock terminal group"}
                        title={locked ? "Unlock terminal group" : "Lock terminal group"}
                        className={cn(
                          "grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white",
                          locked && "text-primary hover:text-primary",
                        )}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => {
                          pushHistory();
                          setNodes((current) =>
                            current.map((item) =>
                              terminalIds.includes(item.id)
                                ? { ...item, locked: !locked }
                                : item,
                            ),
                          );
                        }}
                      >
                        <HugeiconsIcon
                          icon={locked ? LockIcon : SquareUnlock01Icon}
                          size={13}
                          strokeWidth={1.8}
                        />
                      </button>
                      <button
                        type="button"
                        aria-label={maximizedTerminal ? "Restore terminal group" : "Maximize terminal group"}
                        title={maximizedTerminal ? "Restore terminal group" : "Maximize terminal group"}
                        className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() =>
                          setMaximizedTerminalId((current) =>
                            current === activeTerminal ? "" : activeTerminal,
                          )
                        }
                      >
                        {maximizedTerminal ? (
                          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 14h6v6" />
                            <path d="M10 14l-6 6" />
                            <path d="M20 10h-6V4" />
                            <path d="M14 10l6-6" />
                          </svg>
                        ) : (
                          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 3h6v6" />
                            <path d="M9 21H3v-6" />
                            <path d="M21 3l-7 7" />
                            <path d="M3 21l7-7" />
                          </svg>
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label="Close terminal group"
                        title="Close terminal group"
                        className="grid size-5 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-red-500/[0.08] hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:text-zinc-400 dark:hover:bg-red-500/15 dark:hover:text-red-400"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => closeTerminalGroup(group)}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={1.8} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {terminalNodes.map((node) => {
              const layout = terminalLayoutById.get(node.id);
              const terminalGroup = layout
                ? terminalDockGroups.find(
                    (group) => group.id === layout.groupId,
                  )
                : undefined;
              const maximized = maximizedTerminalId === node.id;
              const usesSharedHeader = terminalGroup
                ? terminalDockGroupUsesSharedHeader(terminalGroup)
                : false;
              const terminalGroupIds = terminalGroup
                ? terminalLayouts
                    .filter((candidate) => candidate.groupId === terminalGroup.id)
                    .flatMap((candidate) => candidate.terminalIds)
                : [node.id];
              const terminalGroupLocked = terminalGroupIds.every((terminalId) =>
                Boolean(nodeById.get(terminalId)?.locked),
              );
              const dockBounds = layout?.rect ?? node;
              const bounds = maximized
                ? {
                    x: view.x + 32,
                    y:
                      view.y +
                      32 +
                      (usesSharedHeader ? TERMINAL_DOCK_GROUP_HEADER_HEIGHT : 0),
                    width: Math.max(320, viewWidth - 64),
                    height: Math.max(
                      200,
                      viewHeight -
                        64 -
                        (usesSharedHeader ? TERMINAL_DOCK_GROUP_HEADER_HEIGHT : 0),
                    ),
                  }
                : dockBounds;
              const visible =
                active &&
                (!layout || layout.activeTerminalId === node.id) &&
                (!maximizedTerminalId || maximized);
              const selectionBounds = maximized
                ? bounds
                : terminalGroup ?? bounds;
              const stackTabs = (layout?.terminalIds ?? [node.id])
                .map((terminalId) => {
                  const terminalNode = nodeById.get(terminalId);
                  if (!terminalNode) return null;
                  const cwd = terminalNode.cwd?.replace(/\/$/, "");
                  return {
                    id: terminalId,
                    label:
                      cwd?.split("/").pop() ||
                      terminalNode.label ||
                      "Terminal",
                  };
                })
                .filter(
                  (tab): tab is { id: string; label: string } => tab !== null,
                );
              return (
                <div
                  key={node.id}
                  className={cn(
                    "absolute",
                    selectedNodeIds.includes(node.id) && "z-20",
                    visible
                      ? "pointer-events-auto visible"
                      : "pointer-events-none invisible",
                  )}
                  style={{
                    left: `${bounds.x}px`,
                    top: `${bounds.y}px`,
                    width: `${bounds.width}px`,
                    height: `${bounds.height}px`,
                    transform: `rotate(${node.rotation ?? 0}deg)`,
                    transformOrigin: "center",
                  }}
                >
                  <CanvasTerminalNode
                    initialCwd={node.cwd}
                    initialCommand={node.initialCommand}
                    onHandleChange={(handle) =>
                      onTerminalHandleChange?.(tabId, node.id, handle)
                    }
                    stackTabs={stackTabs}
                    activeTabId={layout?.activeTerminalId ?? node.id}
                    singleTerminalGroup={!usesSharedHeader}
                    terminalGroupLocked={terminalGroupLocked}
                    maximized={maximized}
                    onToggleTerminalGroupLock={() => {
                      pushHistory();
                      setNodes((current) =>
                        current.map((item) =>
                          terminalGroupIds.includes(item.id)
                            ? { ...item, locked: !terminalGroupLocked }
                            : item,
                        ),
                      );
                    }}
                    onToggleTerminalGroupMaximize={() =>
                      setMaximizedTerminalId((current) =>
                        current === node.id ? "" : node.id,
                      )
                    }
                    onRequestCloseTerminalGroup={() => {
                      if (terminalGroup) {
                        closeTerminalGroup(terminalGroup);
                        return;
                      }
                      eraseNode(node.id);
                    }}
                    visible={visible}
                    resizePaused={terminalResizePaused}
                    panning={mode === "pan"}
                    onCanvasPanStart={(event) => startPan(event)}
                    onCanvasPanMove={(event) =>
                      handlePointerMove(
                        event as unknown as ReactPointerEvent<SVGSVGElement>,
                      )
                    }
                    onCanvasPanEnd={() => handlePointerEnd()}
                    onCanvasWheel={(event) =>
                      handleCanvasWheel(
                        event as unknown as ReactWheelEvent<SVGSVGElement>,
                      )
                    }
                    cornerClassName={
                      maximized
                        ? "rounded-[12px]"
                        : terminalDockCornerClassName(
                            bounds,
                            terminalGroup ?? bounds,
                          )
                    }
                    onActivate={() => {
                      setActiveTerminalId(node.id);
                      selectSingleNode(node.id);
                    }}
                    onActivateTab={(terminalId) => {
                      setActiveTerminalId(terminalId);
                      selectSingleNode(terminalId);
                      if (maximized) {
                        setMaximizedTerminalId(terminalId);
                      }
                      if (layout) {
                        setTerminalDockGroups((current) =>
                          activateTerminalTab(
                            current,
                            layout.stackId,
                            terminalId,
                          ),
                        );
                      }
                    }}
                    onRequestCloseTab={(terminalId) => {
                      const nextActiveTerminalId = layout?.terminalIds.find(
                        (id) => id !== terminalId,
                      ) ?? "";
                      if (activeTerminalId === terminalId) {
                        setActiveTerminalId(nextActiveTerminalId);
                      }
                      if (maximizedTerminalId === terminalId) {
                        setMaximizedTerminalId(nextActiveTerminalId);
                      }
                      eraseNode(terminalId);
                    }}
                    onAddTab={() => {
                      if (!layout) return;
                      createDockedTerminal(layout, "tab", node);
                    }}
                    onSplitRight={() => {
                      if (!layout) return;
                      createDockedTerminal(layout, "split", node);
                    }}
                    onHeaderPointerDown={(event) => {
                      if (maximized) {
                        event.preventDefault();
                        event.stopPropagation();
                        setMaximizedTerminalId("");
                        return;
                      }
                      if (terminalGroup && !usesSharedHeader) {
                        handleTerminalGroupHeaderPointerDown(
                          event,
                          terminalGroup,
                          node,
                          terminalGroupLocked,
                        );
                        return;
                      }
                      handleNodePointerDown(
                        event as unknown as ReactPointerEvent<SVGGElement>,
                        node,
                      );
                    }}
                    onCwdChange={(cwd) =>
                      setNodes((current) =>
                        current.map((item) =>
                          item.id === node.id ? { ...item, cwd } : item,
                        ),
                      )
                    }
                  />
                  {selectedNodeIds.includes(node.id) && !node.locked ? (
                    <div
                      className="pointer-events-none absolute rounded-[12px] border-2 border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.16),0_8px_24px_rgba(59,130,246,0.20)]"
                      style={{
                        left: `${((selectionBounds.x - bounds.x) / bounds.width) * 100}%`,
                        top: `${((selectionBounds.y - bounds.y) / bounds.height) * 100}%`,
                        width: `${(selectionBounds.width / bounds.width) * 100}%`,
                        height: `${(selectionBounds.height / bounds.height) * 100}%`,
                      }}
                    >
                      {[
                        {
                          handle: "nw" as const,
                          className: "-left-2 -top-2 cursor-nw-resize",
                        },
                        {
                          handle: "ne" as const,
                          className: "-right-2 -top-2 cursor-ne-resize",
                        },
                        {
                          handle: "se" as const,
                          className: "-bottom-2 -right-2 cursor-se-resize",
                        },
                        {
                          handle: "sw" as const,
                          className: "-bottom-2 -left-2 cursor-sw-resize",
                        },
                      ].map((corner) => (
                        <button
                          key={corner.handle}
                          type="button"
                          aria-label={`Resize terminal from ${corner.handle} corner`}
                          className={cn(
                            "pointer-events-auto absolute size-5 border-0 bg-transparent p-0 outline-none",
                            corner.className,
                          )}
                          onPointerDown={(event) =>
                            handleResizePointerDown(
                              event as unknown as ReactPointerEvent<SVGRectElement>,
                              node,
                              corner.handle,
                            )
                          }
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
              })}
              {terminalDockDividers.map((divider) => {
                const vertical = divider.direction === "horizontal";
                const position = vertical
                  ? {
                      left: `${divider.rect.x + divider.rect.width * divider.ratio - 4}px`,
                      top: `${divider.rect.y}px`,
                      width: "8px",
                      height: `${divider.rect.height}px`,
                    }
                  : {
                      left: `${divider.rect.x}px`,
                      top: `${divider.rect.y + divider.rect.height * divider.ratio - 4}px`,
                      width: `${divider.rect.width}px`,
                      height: "8px",
                    };
                return (
                  <div
                    key={`${divider.groupId}-${divider.splitId}`}
                    role="separator"
                    aria-orientation={vertical ? "vertical" : "horizontal"}
                    aria-label={`Resize docked terminals ${vertical ? "horizontally" : "vertically"}`}
                    tabIndex={0}
                    className={cn(
                      "pointer-events-auto absolute z-30 outline-none after:absolute after:bg-border/70 hover:after:bg-blue-500 focus-visible:after:bg-blue-500",
                      vertical
                        ? "cursor-col-resize after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2"
                        : "cursor-row-resize after:left-0 after:top-1/2 after:h-px after:w-full after:-translate-y-1/2",
                    )}
                    style={position}
                    onPointerDown={(event) =>
                      handleDockDividerPointerDown(event, divider)
                    }
                    onPointerMove={(event) =>
                      handleDockDividerPointerMove(event, divider)
                    }
                    onPointerUp={finishDockDividerResize}
                    onPointerCancel={finishDockDividerResize}
                    onKeyDown={(event) =>
                      handleDockDividerKeyDown(event, divider)
                    }
                  />
                );
              })}
            </div>
          </div>

          {terminalDropPreview ? (
            <div
              className="pointer-events-none absolute z-10 flex items-center justify-center rounded-[12px] border-2 border-blue-500 bg-blue-500/[0.12] shadow-[0_10px_30px_rgba(59,130,246,0.22)]"
              style={{
                left: `${((terminalDropPreview.x - view.x) / viewWidth) * 100}%`,
                top: `${((terminalDropPreview.y - view.y) / viewHeight) * 100}%`,
                width: `${(terminalDropPreview.width / viewWidth) * 100}%`,
                height: `${(terminalDropPreview.height / viewHeight) * 100}%`,
              }}
            >
              <span className="rounded-full bg-blue-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
                Drop to place
              </span>
            </div>
          ) : null}

          {terminalDockDropTarget && terminalDockIndicator ? (
            <div
              data-terminal-drop-target={
                terminalDockDropTarget.kind === "tab"
                  ? "tab"
                  : `split-${terminalDockDropTarget.edge}`
              }
              className="pointer-events-none absolute z-20 flex items-center justify-center rounded-md border-2 border-blue-500/60 bg-blue-500/[0.12] text-blue-600 shadow-[0_8px_24px_rgba(59,130,246,0.16)] dark:text-blue-300"
              style={{
                left: `${((terminalDockIndicator.x - view.x) / viewWidth) * 100}%`,
                top: `${((terminalDockIndicator.y - view.y) / viewHeight) * 100}%`,
                width: `${(terminalDockIndicator.width / viewWidth) * 100}%`,
                height:
                  terminalDockDropTarget.kind === "tab"
                    ? "38px"
                    : `${(terminalDockIndicator.height / viewHeight) * 100}%`,
              }}
            >
              <span className="rounded-full bg-blue-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
                {terminalDockDropTarget.kind === "tab"
                  ? "+ Tab"
                  : `Split ${terminalDockDropTarget.edge}`}
              </span>
            </div>
          ) : null}

          {terminalPlacements.length > 0 ? (
            <div className="pointer-events-none absolute inset-0 z-30">
              {isFreeTerminalPlacement ? (
                <div
                  className="pointer-events-auto absolute inset-0 cursor-crosshair"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    commitFreeTerminalPlacement(svgPointFromClient(event));
                  }}
                />
              ) : null}
              {terminalPlacements.map((placement, index) => (
                <button
                  key={`${placement.x}-${placement.y}`}
                  type="button"
                  aria-label={`Place terminal in spot ${index + 1}`}
                  className="pointer-events-auto absolute flex items-center justify-center rounded-lg border border-blue-400/70 bg-blue-500/[0.10] transition hover:border-blue-500 hover:bg-blue-500/[0.18] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  style={{
                    left: `${((placement.x - view.x) / viewWidth) * 100}%`,
                    top: `${((placement.y - view.y) / viewHeight) * 100}%`,
                    width: `${(placement.width / viewWidth) * 100}%`,
                    height: `${(placement.height / viewHeight) * 100}%`,
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    commitTerminalPlacement(placement);
                  }}
                >
                  <span className="flex flex-col items-center gap-1.5">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500 text-lg font-bold text-white shadow-lg">
                      {index + 1}
                    </span>
                    {index === 0 ? (
                      <span className="rounded-md bg-blue-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                        Best
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
              <div className="pointer-events-none absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full border border-zinc-200 bg-white/95 px-3 py-1.5 text-xs font-medium text-zinc-600 shadow-lg backdrop-blur">
                {isFreeTerminalPlacement ? (
                  <>Click anywhere to place · <kbd className="rounded border bg-zinc-100 px-1">F</kbd> to go back · <kbd className="rounded border bg-zinc-100 px-1">Esc</kbd> to cancel</>
                ) : (
                  <>Pick a spot · <kbd className="rounded border bg-zinc-100 px-1">1</kbd>–<kbd className="rounded border bg-zinc-100 px-1">6</kbd> or click a ghost · <kbd className="rounded border bg-zinc-100 px-1">F</kbd> anywhere · <kbd className="rounded border bg-zinc-100 px-1">Esc</kbd> to cancel</>
                )}
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-md border border-zinc-200 bg-white/85 px-2 py-1 text-[10px] text-zinc-500">
            <span>{nodes.length} shapes</span>
            <span className="h-3 w-px bg-zinc-200" />
            <span>{edges.length} connections</span>
            <span className="h-3 w-px bg-zinc-200" />
            <span>{Math.round(view.scale * 100)}%</span>
          </div>

          {onToggleCanvasFocus ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute bottom-3 right-3 z-20 size-11 rounded-full border border-zinc-200 bg-white/90 text-zinc-600 shadow-sm backdrop-blur hover:bg-white hover:text-zinc-950"
              onClick={onToggleCanvasFocus}
              title={canvasFocused ? "Restore canvas sidebars" : "Focus canvas"}
              aria-label={canvasFocused ? "Restore canvas sidebars" : "Focus canvas"}
              aria-pressed={canvasFocused}
            >
              <CanvasFocusIcon focused={canvasFocused} />
            </Button>
          ) : null}
        </main>

      </div>
    </div>
  );
}

function CanvasFocusIcon({ focused }: { focused: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="3.5" />
      {focused ? (
        <>
          <path d="m5.5 18.5 5-5" />
          <path d="M5.5 13.5h5v5" />
          <path d="m18.5 5.5-5 5" />
          <path d="M18.5 10.5h-5v-5" />
        </>
      ) : (
        <>
          <path d="m5.5 18.5 13-13" />
          <path d="M13.5 5.5h5v5" />
          <path d="M5.5 13.5v5h5" />
        </>
      )}
    </svg>
  );
}

function ToolButton({
  active = false,
  disabled = false,
  icon,
  iconNode,
  label,
  onClick,
  shortcut,
}: {
  active?: boolean;
  disabled?: boolean;
  icon?: typeof Cursor01Icon;
  iconNode?: ReactNode;
  label: string;
  onClick: () => void;
  shortcut?: string;
}) {
  const title = shortcut ? `${label} (${shortcut})` : label;
  return (
    <Button
      type="button"
      size="icon-xs"
      variant="ghost"
      disabled={disabled}
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "h-11 w-11 shrink-0 rounded-full border border-transparent text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950",
        active && "border-zinc-200 bg-zinc-200/90 text-zinc-950 shadow-sm hover:bg-zinc-200",
      )}
    >
      {iconNode ?? (icon ? <HugeiconsIcon icon={icon} size={18} /> : null)}
    </Button>
  );
}

function PanToolIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-7 w-7 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.9}
      viewBox="0 0 24 24"
    >
      <path d="M7.75 11.75V6.5a1.5 1.5 0 0 1 3 0v4.25" />
      <path d="M10.75 10.75V4.75a1.5 1.5 0 0 1 3 0v6" />
      <path d="M13.75 10.75V5.75a1.5 1.5 0 0 1 3 0v5" />
      <path d="M16.75 11.25v-2a1.5 1.5 0 0 1 3 0v4.5a6.25 6.25 0 0 1-6.25 6.25h-1.1a5.1 5.1 0 0 1-3.6-1.5l-4-4a1.5 1.5 0 0 1 2.12-2.12l.88.88v-1.5Z" />
    </svg>
  );
}

function DiagramNode({
  node,
  selected,
  editing,
  pendingConnect,
  markerId,
  frameDotsId,
  onPointerDown,
  onDoubleClick,
  onTextChange,
  onTextEditEnd,
  onResizePointerDown,
  onRotatePointerDown,
  onConnectorPointerDown,
}: {
  node: ArchitectureNode;
  selected: boolean;
  editing: boolean;
  pendingConnect: boolean;
  markerId: string;
  frameDotsId: string;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
  onDoubleClick: (event: ReactMouseEvent<SVGGElement>) => void;
  onTextChange: (label: string) => void;
  onTextEditEnd: () => void;
  onResizePointerDown: (
    event: ReactPointerEvent<SVGRectElement>,
    node: ArchitectureNode,
    handle: ResizeHandle,
  ) => void;
  onRotatePointerDown: (
    event: ReactPointerEvent<SVGCircleElement>,
    node: ArchitectureNode,
  ) => void;
  onConnectorPointerDown: (
    event: ReactPointerEvent<SVGCircleElement>,
    node: ArchitectureNode,
    handle: ConnectorHandle,
  ) => void;
}) {
  const shape = shapeFor(node.kind);
  const selectedClass = selected ? "stroke-primary" : "stroke-border";
  const nodeClassName = cn(
    node.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing",
    selected && "text-primary",
  );
  const transform = nodeTransform(node);

  if (isConnectorKind(node.kind)) {
    const path = connectorPath(node);
    const control = connectorControlPoint(node);
    return (
      <g
        transform={`translate(${node.x} ${node.y})`}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth="16"
        />
        <path
          d={path}
          fill="none"
          className={cn(selected ? "stroke-primary" : "stroke-foreground/70")}
          strokeDasharray={node.locked ? "6 5" : undefined}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={selected ? 3 : 2}
          markerEnd={node.kind === "arrow" ? `url(#${markerId})` : undefined}
        />
        {selected && !node.locked ? (
          <ConnectorHandles
            control={control}
            end={{ x: node.width, y: node.height }}
            node={node}
            onConnectorPointerDown={onConnectorPointerDown}
          />
        ) : null}
        {node.locked ? <NodeLockBadge x={node.width} y={node.height} /> : null}
      </g>
    );
  }

  if (node.kind === "pen") {
    const points = pointsToString(node.points ?? [{ x: 0, y: 0 }]);
    return (
      <g
        transform={`translate(${node.x} ${node.y})`}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <polyline
          points={points}
          fill="none"
          stroke="transparent"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="16"
        />
        <polyline
          points={points}
          fill="none"
          className={cn(selected ? "stroke-primary" : "stroke-foreground/75")}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={node.locked ? "6 5" : undefined}
          strokeWidth={selected ? 3 : 2}
        />
        {node.locked ? <NodeLockBadge x={18} y={-18} /> : null}
      </g>
    );
  }

  if (node.kind === "rectangle") {
    return (
      <g
        transform={transform}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <rect
          width={node.width}
          height={node.height}
          rx="12"
          fill="none"
          className={cn(
            "stroke-foreground/80",
            selected && "stroke-primary",
            pendingConnect && "stroke-amber-500",
          )}
          strokeDasharray={node.locked ? "6 5" : undefined}
          strokeWidth={selected || pendingConnect ? 3 : 1.8}
        />
        {node.label ? (
          <text
            x={node.width / 2}
            y={node.height / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            pointerEvents="none"
            className="fill-foreground text-[24px] font-semibold"
          >
            {node.label}
          </text>
        ) : null}
        {selected && !node.locked ? (
          <SelectionHandles
            node={node}
            onResizePointerDown={onResizePointerDown}
            onRotatePointerDown={onRotatePointerDown}
          />
        ) : null}
        {node.locked ? <NodeLockBadge x={node.width - 8} y="-8" /> : null}
      </g>
    );
  }

  if (node.kind === "frame") {
    return (
      <g
        transform={transform}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <rect
          width={node.width}
          height={node.height}
          rx="22"
          className={cn("fill-background/20", selectedClass)}
          strokeDasharray={node.locked ? "8 7" : undefined}
          strokeWidth={selected ? 4 : 3}
        />
        <rect
          x="16"
          y="16"
          width={Math.max(0, node.width - 32)}
          height={Math.max(0, node.height - 32)}
          fill={`url(#${frameDotsId})`}
          className="text-muted-foreground"
          opacity="0.65"
        />
        {selected && !node.locked ? (
          <SelectionHandles
            node={node}
            onResizePointerDown={onResizePointerDown}
            onRotatePointerDown={onRotatePointerDown}
          />
        ) : null}
        {node.locked ? <NodeLockBadge x={node.width - 10} y={-10} /> : null}
      </g>
    );
  }

  if (node.kind === "circle") {
    return (
      <g
        transform={transform}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <ellipse
          cx={node.width / 2}
          cy={node.height / 2}
          rx={node.width / 2}
          ry={node.height / 2}
          fill="none"
          className={selectedClass}
          strokeDasharray={node.locked ? "6 5" : undefined}
          strokeWidth={selected || pendingConnect ? 3 : 1.5}
        />
        {selected && !node.locked ? (
          <SelectionHandles
            node={node}
            onResizePointerDown={onResizePointerDown}
            onRotatePointerDown={onRotatePointerDown}
          />
        ) : null}
        {node.locked ? <NodeLockBadge x={node.width - 8} y="-8" /> : null}
      </g>
    );
  }

  if (node.kind === "text") {
    const lines = textNodeLines(node.label || "Text");
    const lineHeight = 28;
    const firstLineY = node.height / 2 - ((lines.length - 1) * lineHeight) / 2;
    return (
      <g
        transform={transform}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <rect
          width={node.width}
          height={node.height}
          rx="8"
          fill="transparent"
          className={cn(selected ? "stroke-primary" : "stroke-transparent")}
          strokeDasharray="5 5"
          strokeWidth="1.5"
        />
        <text
          x={node.width / 2}
          y={node.height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className={cn(
            "fill-foreground text-[24px] font-medium",
            editing && "opacity-0",
          )}
        >
          {lines.map((line, index) => (
            <tspan
              key={`${line}-${index}`}
              x={node.width / 2}
              y={firstLineY + index * lineHeight}
            >
              {line}
            </tspan>
          ))}
        </text>
        {editing ? (
          <foreignObject x="0" y="0" width={node.width} height={node.height}>
            <div className="flex h-full items-center">
              <textarea
                autoFocus
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                className="w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-center text-[24px] font-medium leading-[28px] text-foreground shadow-none outline-none ring-0 [appearance:none]"
                style={{
                  height: Math.min(
                    node.height,
                    Math.max(lineHeight, lines.length * lineHeight),
                  ),
                }}
                placeholder="Text"
                value={node.label}
                onPointerDown={(event) => event.stopPropagation()}
                onDoubleClick={(event) => event.stopPropagation()}
                onChange={(event: ReactChangeEvent<HTMLTextAreaElement>) =>
                  onTextChange(event.target.value)
                }
                onBlur={onTextEditEnd}
                onKeyDown={(event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
                  if (event.key === "Escape") {
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
          </foreignObject>
        ) : null}
        {selected && !node.locked ? (
          <SelectionHandles
            node={node}
            onResizePointerDown={onResizePointerDown}
            onRotatePointerDown={onRotatePointerDown}
          />
        ) : null}
        {node.locked ? <NodeLockBadge x={node.width} y="0" /> : null}
      </g>
    );
  }

  if (node.kind === "image") {
    return (
      <g
        transform={transform}
        onPointerDown={onPointerDown}
        onDoubleClick={onDoubleClick}
        className={nodeClassName}
      >
        <rect
          width={node.width}
          height={node.height}
          rx="12"
          className={cn("fill-background stroke-border", selectedClass)}
          strokeDasharray={node.locked ? "6 5" : undefined}
          strokeWidth={selected || pendingConnect ? 3 : 1.5}
        />
        {node.imageUrl ? (
          <image
            href={node.imageUrl}
            x="1"
            y="1"
            width={node.width - 2}
            height={node.height - 2}
            preserveAspectRatio="xMidYMid slice"
          />
        ) : (
          <foreignObject x="0" y="0" width={node.width} height={node.height}>
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <HugeiconsIcon icon={ImageAdd01Icon} size={24} />
              <div className="text-[12px] font-medium">Image</div>
            </div>
          </foreignObject>
        )}
        {selected && !node.locked ? (
          <SelectionHandles
            node={node}
            onResizePointerDown={onResizePointerDown}
            onRotatePointerDown={onRotatePointerDown}
          />
        ) : null}
        {node.locked ? <NodeLockBadge x={node.width - 8} y="-8" /> : null}
      </g>
    );
  }

  if (node.kind === "terminal") {
    return null;
  }

  return (
    <g
      transform={transform}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      className={nodeClassName}
    >
      {node.kind === "boundary" ? (
        <rect
          width={node.width}
          height={node.height}
          rx="12"
          fill="none"
          strokeDasharray={node.locked ? "4 4" : "8 7"}
          className={cn(
            "stroke-border",
            selected && "stroke-primary",
            pendingConnect && "stroke-amber-500",
          )}
          strokeWidth={selected || pendingConnect ? 3 : 1.5}
        />
      ) : (
        <rect
          width={node.width}
          height={node.height}
          rx={node.kind === "database" ? 18 : 10}
          className={cn(
            "fill-background stroke-border",
            selected && "stroke-primary",
            pendingConnect && "stroke-amber-500",
          )}
          strokeDasharray={node.locked ? "6 5" : undefined}
          strokeWidth={selected || pendingConnect ? 3 : 1.5}
        />
      )}
      {node.kind === "database" ? (
        <path
          d={`M 0 22 C 0 5, ${node.width} 5, ${node.width} 22`}
          fill="none"
          className="stroke-border"
          strokeWidth="1.5"
        />
      ) : null}
      <foreignObject x="12" y="12" width={node.width - 24} height={node.height - 24}>
        <div className="flex h-full min-w-0 items-center gap-2">
          <div
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-md border",
              shape.tone,
            )}
          >
            <HugeiconsIcon icon={shape.icon} size={17} strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-foreground">
              {node.label || shape.label}
            </div>
            <div className="truncate text-[10px] text-muted-foreground">
              {node.technology || shape.description}
            </div>
          </div>
        </div>
      </foreignObject>
      {node.locked ? <NodeLockBadge x={node.width - 8} y="-8" /> : null}
    </g>
  );
}

function nodeTransform(node: ArchitectureNode): string {
  return `translate(${node.x} ${node.y}) rotate(${node.rotation ?? 0} ${node.width / 2} ${node.height / 2})`;
}

function SelectionHandles({
  node,
  onResizePointerDown,
  onRotatePointerDown,
}: {
  node: ArchitectureNode;
  onResizePointerDown: (
    event: ReactPointerEvent<SVGRectElement>,
    node: ArchitectureNode,
    handle: ResizeHandle,
  ) => void;
  onRotatePointerDown: (
    event: ReactPointerEvent<SVGCircleElement>,
    node: ArchitectureNode,
  ) => void;
}) {
  const handleSize = 10;
  const centerX = node.width / 2;
  const handles: Array<{
    handle: ResizeHandle;
    x: number;
    y: number;
    cursor: string;
  }> = [
    { handle: "nw", x: 0, y: 0, cursor: "cursor-nw-resize" },
    { handle: "ne", x: node.width, y: 0, cursor: "cursor-ne-resize" },
    { handle: "se", x: node.width, y: node.height, cursor: "cursor-se-resize" },
    { handle: "sw", x: 0, y: node.height, cursor: "cursor-sw-resize" },
  ];

  return (
    <g className="pointer-events-auto text-primary">
      <rect
        width={node.width}
        height={node.height}
        fill="none"
        className="stroke-primary"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={centerX}
        y1="0"
        x2={centerX}
        y2="-28"
        className="stroke-primary"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={centerX}
        cy="-38"
        r="7"
        data-rotate-handle="true"
        className="cursor-grab fill-background stroke-primary active:cursor-grabbing"
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
        onPointerDown={(event) => onRotatePointerDown(event, node)}
      />
      {handles.map((item) => (
        <rect
          key={item.handle}
          x={item.x - handleSize / 2}
          y={item.y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          rx="2.5"
          data-resize-handle={item.handle}
          className={cn("fill-background stroke-primary", item.cursor)}
          strokeWidth="1.8"
          vectorEffect="non-scaling-stroke"
          onPointerDown={(event) =>
            onResizePointerDown(event, node, item.handle)
          }
        />
      ))}
    </g>
  );
}

function ConnectorHandles({
  control,
  end,
  node,
  onConnectorPointerDown,
}: {
  control: Point;
  end: Point;
  node: ArchitectureNode;
  onConnectorPointerDown: (
    event: ReactPointerEvent<SVGCircleElement>,
    node: ArchitectureNode,
    handle: ConnectorHandle,
  ) => void;
}) {
  const handles: Array<{
    handle: ConnectorHandle;
    point: Point;
    cursor: string;
  }> = [
    { handle: "start", point: { x: 0, y: 0 }, cursor: "cursor-move" },
    {
      handle: "control",
      point: control,
      cursor: "cursor-grab active:cursor-grabbing",
    },
    { handle: "end", point: end, cursor: "cursor-move" },
  ];

  return (
    <g className="pointer-events-auto text-primary">
      <line
        x1="0"
        y1="0"
        x2={control.x}
        y2={control.y}
        className="stroke-primary/45"
        strokeDasharray="4 4"
        strokeWidth="1.3"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1={control.x}
        y1={control.y}
        x2={end.x}
        y2={end.y}
        className="stroke-primary/45"
        strokeDasharray="4 4"
        strokeWidth="1.3"
        vectorEffect="non-scaling-stroke"
      />
      {handles.map((item) => (
        <circle
          key={item.handle}
          cx={item.point.x}
          cy={item.point.y}
          r={item.handle === "control" ? 6.5 : 5.5}
          data-connector-handle={item.handle}
          className={cn("fill-background stroke-primary", item.cursor)}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          onPointerDown={(event) =>
            onConnectorPointerDown(event, node, item.handle)
          }
        />
      ))}
    </g>
  );
}

function NodeLockBadge({ x, y }: { x: number | string; y: number | string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="10" className="fill-background stroke-amber-500" />
      <HugeiconsIcon
        icon={LockIcon}
        size={12}
        x={-6}
        y={-6}
        className="text-amber-500"
      />
    </g>
  );
}

const EDGE_NODE_OVERLAP = 4;

function edgeAnchorPoint(
  source: ArchitectureNode,
  target: ArchitectureNode,
  enterTarget: boolean,
): Point {
  const boundary = boundaryPoint(source, nodeCenter(target));
  if (!enterTarget) return boundary;
  const targetCenter = nodeCenter(source);
  const dx = targetCenter.x - boundary.x;
  const dy = targetCenter.y - boundary.y;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return boundary;
  return {
    x: boundary.x + (dx / distance) * EDGE_NODE_OVERLAP,
    y: boundary.y + (dy / distance) * EDGE_NODE_OVERLAP,
  };
}

function nodeCenter(node: ArchitectureNode): Point {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

function pointInsideNode(point: Point, node: ArchitectureNode): boolean {
  return (
    point.x >= node.x &&
    point.x <= node.x + node.width &&
    point.y >= node.y &&
    point.y <= node.y + node.height
  );
}

function boundaryPoint(source: ArchitectureNode, target: Point): Point {
  const center = nodeCenter(source);
  const dx = target.x - center.x;
  const dy = target.y - center.y;
  const halfWidth = Math.max(Math.abs(source.width) / 2, 1);
  const halfHeight = Math.max(Math.abs(source.height) / 2, 1);
  const scale = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(dy),
  );
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale,
  };
}

function connectorControlPoint(node: ArchitectureNode): Point {
  return node.points?.[0] ?? { x: node.width / 2, y: node.height / 2 };
}

function connectorAbsoluteControl(node: ArchitectureNode): Point {
  const control = connectorControlPoint(node);
  return { x: node.x + control.x, y: node.y + control.y };
}

function connectorPath(node: ArchitectureNode): string {
  const control = connectorControlPoint(node);
  return `M 0 0 Q ${control.x} ${control.y}, ${node.width} ${node.height}`;
}

function resolveConnectorNode(
  item: ArchitectureNode,
  nodes: ArchitectureNode[],
): ArchitectureNode {
  if (!isConnectorKind(item.kind)) return item;
  const geometry = connectorGeometry(item, nodes);
  return {
    ...item,
    x: geometry.start.x,
    y: geometry.start.y,
    width: geometry.end.x - geometry.start.x,
    height: geometry.end.y - geometry.start.y,
    points: [
      {
        x: geometry.control.x - geometry.start.x,
        y: geometry.control.y - geometry.start.y,
      },
    ],
  };
}

function connectorGeometry(
  item: ArchitectureNode,
  nodes: ArchitectureNode[],
): { start: Point; control: Point; end: Point } {
  const rawControl = connectorAbsoluteControl(item);
  const rawStart = { x: item.x, y: item.y };
  const rawEnd = { x: item.x + item.width, y: item.y + item.height };
  const startTarget = nodes.find((node) => node.id === item.connectorStartId);
  const endTarget = nodes.find((node) => node.id === item.connectorEndId);
  const startReference = endTarget ? nodeCenter(endTarget) : rawEnd;
  const endReference = startTarget ? nodeCenter(startTarget) : rawStart;
  return {
    start: startTarget ? boundaryPoint(startTarget, startReference) : rawStart,
    control: rawControl,
    end: endTarget ? boundaryPoint(endTarget, endReference) : rawEnd,
  };
}

function snapConnectorEndpoint(
  point: Point,
  connector: ArchitectureNode,
  nodes: ArchitectureNode[],
): { nodeId: string; point: Point } | null {
  let nearest: { node: ArchitectureNode; distance: number } | null = null;
  for (const node of nodes) {
    if (node.id === connector.id || isDrawingOnlyKind(node.kind)) continue;
    const nextDistance = distance(point, boundaryPoint(node, point));
    if (nextDistance > CONNECTOR_SNAP_DISTANCE) continue;
    if (!nearest || nextDistance < nearest.distance) {
      nearest = { node, distance: nextDistance };
    }
  }
  if (!nearest) return null;
  return {
    nodeId: nearest.node.id,
    point: boundaryPoint(nearest.node, point),
  };
}

function updateDraggedNodes(
  nodes: ArchitectureNode[],
  drag: DragState,
  point: Point,
  bounds: { x: number; y: number; width: number; height: number },
  selectedNodeIds: string[],
): ArchitectureNode[] {
  const dragged = nodes.find((item) => item.id === drag.id);
  if (!dragged || dragged.locked) return nodes;

  const { x: nextX, y: nextY } = draggedNodeAtPoint(
    dragged,
    drag,
    point,
    bounds,
  );
  const dx = nextX - dragged.x;
  const dy = nextY - dragged.y;
  const movedDragged = {
    ...dragged,
    x: nextX,
    y: nextY,
  };
  const groupIds = new Set(
    selectedNodeIds.includes(dragged.id) ? selectedNodeIds : [dragged.id],
  );
  const nextAnchor =
    dragged.kind === "text"
      ? snapTextAttachment(movedDragged, nodes)?.nodeId
      : dragged.textAnchorId;
  const nextFrameId =
    dragged.kind === "terminal"
      ? snapTerminalFrame(movedDragged, nodes)?.nodeId
      : dragged.frameId;

  return nodes.map((item) => {
    if (item.id === dragged.id) {
      if (dragged.kind === "text") {
        return { ...movedDragged, textAnchorId: nextAnchor };
      }
      if (dragged.kind === "terminal") {
        return { ...movedDragged, frameId: nextFrameId };
      }
      return movedDragged;
    }
    if (groupIds.has(item.id) && !item.locked) {
      return {
        ...item,
        x: clamp(
          item.x + dx,
          bounds.x + 16,
          bounds.x + bounds.width - item.width - 16,
        ),
        y: clamp(
          item.y + dy,
          bounds.y + 16,
          bounds.y + bounds.height - item.height - 16,
        ),
      };
    }
    if (
      item.kind === "text" &&
      item.textAnchorId &&
      groupIds.has(item.textAnchorId) &&
      !groupIds.has(item.id)
    ) {
      return {
        ...item,
        x: item.x + dx,
        y: item.y + dy,
      };
    }
    if (
      item.kind === "terminal" &&
      item.frameId &&
      groupIds.has(item.frameId) &&
      !groupIds.has(item.id)
    ) {
      return {
        ...item,
        x: item.x + dx,
        y: item.y + dy,
      };
    }
    return item;
  });
}

function draggedNodeAtPoint(
  node: ArchitectureNode,
  drag: DragState,
  point: Point,
  bounds: { x: number; y: number; width: number; height: number },
): Pick<ArchitectureNode, "x" | "y" | "width" | "height"> {
  const width = drag.sourceBounds?.width ?? node.width;
  const height = drag.sourceBounds?.height ?? node.height;
  return {
    x: clamp(
      point.x - drag.dx,
      bounds.x + 16,
      bounds.x + bounds.width - width - 16,
    ),
    y: clamp(
      point.y - drag.dy,
      bounds.y + 16,
      bounds.y + bounds.height - height - 16,
    ),
    width,
    height,
  };
}

function wheelPanDelta(event: ReactWheelEvent<SVGSVGElement>): Point {
  const multiplier = event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? 240 : 1;
  return {
    x: event.deltaX * multiplier * TRACKPAD_PAN_SENSITIVITY,
    y: event.deltaY * multiplier * TRACKPAD_PAN_SENSITIVITY,
  };
}

function snapTextAttachment(
  textNode: ArchitectureNode,
  nodes: ArchitectureNode[],
): { nodeId: string } | null {
  const center = nodeCenter(textNode);
  let nearest: { node: ArchitectureNode; distance: number } | null = null;
  for (const node of nodes) {
    if (
      node.id === textNode.id ||
      node.kind === "text" ||
      isDrawingOnlyKind(node.kind)
    ) {
      continue;
    }
    const inside = pointInsideNode(center, node);
    const nextDistance = inside ? 0 : distance(center, boundaryPoint(node, center));
    if (nextDistance > TEXT_ATTACH_DISTANCE) continue;
    if (!nearest || nextDistance < nearest.distance) {
      nearest = { node, distance: nextDistance };
    }
  }
  return nearest ? { nodeId: nearest.node.id } : null;
}

function snapTerminalFrame(
  terminal: ArchitectureNode,
  nodes: ArchitectureNode[],
): { nodeId: string } | null {
  const center = nodeCenter(terminal);
  const frames = nodes.filter(
    (node) => node.kind === "frame" && pointInsideNode(center, node),
  );
  if (frames.length === 0) return null;

  const closestFrame = frames.reduce((closest, frame) =>
    frame.width * frame.height < closest.width * closest.height
      ? frame
      : closest,
  );
  return { nodeId: closestFrame.id };
}

function updateDrawingNode(
  item: ArchitectureNode,
  drawing: DrawingState,
  point: Point,
  nodes: ArchitectureNode[],
): ArchitectureNode {
  if (drawing.kind === "pen") {
    const nextPoint = { x: point.x - item.x, y: point.y - item.y };
    const points = item.points ?? [{ x: 0, y: 0 }];
    const last = points[points.length - 1];
    if (last && distance(last, nextPoint) < 3) return item;
    return {
      ...item,
      points: [...points, nextPoint],
      width: Math.max(item.width, Math.abs(nextPoint.x), 1),
      height: Math.max(item.height, Math.abs(nextPoint.y), 1),
    };
  }
  if (drawing.kind === "line" || drawing.kind === "arrow") {
    const startSnap = snapConnectorEndpoint(drawing.start, item, nodes);
    const endSnap = snapConnectorEndpoint(point, item, nodes);
    const start = startSnap?.point ?? drawing.start;
    const end = endSnap?.point ?? point;
    const width = end.x - start.x;
    const height = end.y - start.y;
    return {
      ...item,
      x: start.x,
      y: start.y,
      width,
      height,
      points: [{ x: width / 2, y: height / 2 }],
      connectorStartId: startSnap?.nodeId,
      connectorEndId: endSnap?.nodeId,
    };
  }
  if (isResizableShapeKind(drawing.kind)) {
    return resizeShapeNode(item, drawing.start, point);
  }
  return item;
}

function updateConnectorHandle(
  item: ArchitectureNode,
  connector: ConnectorHandleState,
  point: Point,
  nodes: ArchitectureNode[],
): ArchitectureNode {
  const geometry = connectorGeometry(item, nodes);
  const snap = snapConnectorEndpoint(point, item, nodes);
  const snappedPoint = snap?.point ?? point;
  const attachmentKey =
    connector.handle === "start" ? "connectorStartId" : "connectorEndId";

  if (connector.handle === "start") {
    return {
      ...item,
      x: snappedPoint.x,
      y: snappedPoint.y,
      width: geometry.end.x - snappedPoint.x,
      height: geometry.end.y - snappedPoint.y,
      points: [
        {
          x: geometry.control.x - snappedPoint.x,
          y: geometry.control.y - snappedPoint.y,
        },
      ],
      connectorStartId: snap?.nodeId,
    };
  }

  if (connector.handle === "end") {
    return {
      ...item,
      x: geometry.start.x,
      y: geometry.start.y,
      width: snappedPoint.x - geometry.start.x,
      height: snappedPoint.y - geometry.start.y,
      points: [
        {
          x: geometry.control.x - geometry.start.x,
          y: geometry.control.y - geometry.start.y,
        },
      ],
      [attachmentKey]: snap?.nodeId,
    };
  }

  return {
    ...item,
    x: geometry.start.x,
    y: geometry.start.y,
    width: geometry.end.x - geometry.start.x,
    height: geometry.end.y - geometry.start.y,
    points: [{ x: point.x - geometry.start.x, y: point.y - geometry.start.y }],
  };
}

function resizeShapeNode(
  item: ArchitectureNode,
  start: Point,
  point: Point,
): ArchitectureNode {
  const rect = normalizeDragRect(
    start,
    point,
    minimumDrawingSize(item.kind),
    item.kind === "circle",
  );
  return { ...item, ...rect };
}

function updateResizedNode(
  item: ArchitectureNode,
  resize: ResizeState,
  point: Point,
): ArchitectureNode {
  const rect = normalizeResizeRect(
    resize.startNode,
    resize.handle,
    point,
    item.kind === "circle",
  );
  return { ...item, ...rect, rotation: resize.startNode.rotation };
}

function updateRotatingNode(
  item: ArchitectureNode,
  rotate: RotateState,
  point: Point,
): ArchitectureNode {
  const angle =
    (Math.atan2(point.y - rotate.center.y, point.x - rotate.center.x) * 180) /
      Math.PI +
    90;
  return { ...item, rotation: normalizeRotation(angle) };
}

function normalizeDragRect(
  start: Point,
  point: Point,
  minimum: { width: number; height: number },
  forceSquare = false,
): { x: number; y: number; width: number; height: number } {
  const dx = point.x - start.x;
  const dy = point.y - start.y;
  if (forceSquare) {
    const size = Math.max(Math.abs(dx), Math.abs(dy), minimum.width);
    return {
      x: dx < 0 ? start.x - size : start.x,
      y: dy < 0 ? start.y - size : start.y,
      width: size,
      height: size,
    };
  }
  const width = Math.max(Math.abs(dx), minimum.width);
  const height = Math.max(Math.abs(dy), minimum.height);
  return {
    x: dx < 0 ? start.x - width : start.x,
    y: dy < 0 ? start.y - height : start.y,
    width,
    height,
  };
}

function normalizeResizeRect(
  node: ArchitectureNode,
  handle: ResizeHandle,
  point: Point,
  forceSquare = false,
): { x: number; y: number; width: number; height: number } {
  const minimum = minimumDrawingSize(node.kind);
  const anchor = {
    x: handle.includes("w") ? node.x + node.width : node.x,
    y: handle.includes("n") ? node.y + node.height : node.y,
  };
  if (forceSquare) {
    const size = Math.max(
      Math.abs(point.x - anchor.x),
      Math.abs(point.y - anchor.y),
      minimum.width,
    );
    return {
      x: handle.includes("w") ? anchor.x - size : anchor.x,
      y: handle.includes("n") ? anchor.y - size : anchor.y,
      width: size,
      height: size,
    };
  }
  const width = Math.max(Math.abs(point.x - anchor.x), minimum.width);
  const height = Math.max(Math.abs(point.y - anchor.y), minimum.height);
  return {
    x: handle.includes("w") ? anchor.x - width : anchor.x,
    y: handle.includes("n") ? anchor.y - height : anchor.y,
    width,
    height,
  };
}

function normalizeRotation(value: number): number {
  return Math.round(((value % 360) + 360) % 360);
}

function defaultSize(kind: ShapeKind): { width: number; height: number } {
  switch (kind) {
    case "circle":
      return { width: 120, height: 120 };
    case "frame":
      return { width: 420, height: 280 };
    case "text":
      return { width: 112, height: 40 };
    case "image":
      return { width: 240, height: 150 };
    case "terminal":
      return TERMINAL_DEFAULT_SIZE;
    case "line":
    case "arrow":
    case "pen":
      return { width: 1, height: 1 };
    case "rectangle":
      return { width: 180, height: 96 };
    case "boundary":
      return { width: 260, height: 180 };
    default:
      return { width: NODE_WIDTH, height: NODE_HEIGHT };
  }
}

function minimumDrawingSize(kind: ShapeKind): { width: number; height: number } {
  switch (kind) {
    case "circle":
      return { width: 32, height: 32 };
    case "frame":
      return { width: 80, height: 56 };
    case "text":
      return { width: 48, height: 32 };
    case "image":
      return { width: 80, height: 56 };
    case "terminal":
      return { width: 320, height: 200 };
    case "rectangle":
      return { width: 40, height: 32 };
    default:
      return { width: 1, height: 1 };
  }
}

function defaultTechnology(kind: ShapeKind): string {
  switch (kind) {
    case "actor":
      return "Person / client";
    case "external":
      return "External system";
    case "service":
      return "Service";
    case "api":
      return "HTTP / RPC";
    case "worker":
      return "Async worker";
    case "function":
      return "Serverless";
    case "ai":
      return "LLM / model";
    case "database":
      return "SQL / NoSQL";
    case "cache":
      return "Redis / memory";
    case "queue":
      return "Queue / stream";
    case "storage":
      return "Blob storage";
    case "gateway":
      return "Ingress";
    case "security":
      return "Auth / policy";
    case "boundary":
      return "Boundary";
    case "rectangle":
    case "circle":
    case "frame":
    case "text":
    case "image":
      return "";
    case "terminal":
      return "Shell";
    case "line":
    case "arrow":
    case "pen":
      return "";
  }
}

function isShapeDrawingMode(mode: CanvasMode): mode is ShapeDrawingMode {
  return [
    "rectangle",
    "circle",
    "line",
    "arrow",
    "pen",
    "text",
    "image",
    "frame",
  ].includes(mode);
}

function isConnectorKind(kind: ShapeKind): boolean {
  return kind === "line" || kind === "arrow";
}

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(".xterm")) return true;
  const tag = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tag === "input" ||
    tag === "textarea" ||
    tag === "select"
  );
}

function isResizableShapeKind(kind: ShapeKind): kind is ResizableShapeKind {
    return ["rectangle", "circle", "frame", "text", "image", "terminal"].includes(kind);
}

function isFreehandKind(kind: ShapeKind): boolean {
  return kind === "pen";
}

function isDrawingOnlyKind(kind: ShapeKind): boolean {
  return kind === "line" || kind === "arrow" || kind === "pen";
}

function cloneNodes(nodes: ArchitectureNode[]): ArchitectureNode[] {
  return nodes.map(cloneNode);
}

function cloneNode(item: ArchitectureNode): ArchitectureNode {
  return {
    ...item,
    points: item.points ? item.points.map((point) => ({ ...point })) : undefined,
  };
}

function pointsToString(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function textNodeLines(value: string): string[] {
  const lines = value.split(/\r?\n/);
  return lines.length ? lines.map((line) => line || " ") : [" "];
}

function measureTextNodeSize(label: string): { width: number; height: number } {
  const lines = textNodeLines(label || "Text");
  const maxChars = Math.max(
    ...lines.map((line) => line.trimEnd().length),
    4,
  );
  return {
    width: Math.max(112, Math.ceil(maxChars * 14 + 28)),
    height: Math.max(40, lines.length * 30 + 10),
  };
}

function fitTextNode(node: ArchitectureNode): ArchitectureNode {
  if (node.kind !== "text") return node;
  const size = measureTextNodeSize(node.label);
  return { ...node, width: size.width, height: size.height };
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

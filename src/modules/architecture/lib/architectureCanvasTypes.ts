import type {
  ArchitectureDiagram,
  ArchitectureDiagramEdge,
  ArchitectureDiagramNode,
  ArchitectureShapeKind,
  ArchitectureTerminalDockGroup,
} from "@/modules/tabs";
import type { CanvasTerminalHandle } from "../CanvasTerminalNode";
import { WorkflowSquare01Icon } from "@hugeicons/core-free-icons";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { TerminalDockRect } from "../terminalDockLayout";

export type {
  ArchitectureDiagram,
  ArchitectureTerminalDockGroup,
} from "@/modules/tabs";

export type ShapeKind = ArchitectureShapeKind;
export type LiveSurfaceKind = "terminal" | "browser";
export type CanvasMode =
  | "select"
  | "pan"
  | "connect"
  | "rectangle"
  | "circle"
  | "line"
  | "arrow"
  | "pen"
  | "text"
  | "image"
  | "terminal"
  | "frame"
  | "eraser";
export type ShapeDrawingMode =
  | "rectangle"
  | "circle"
  | "line"
  | "arrow"
  | "pen"
  | "text"
  | "image"
  | "frame";
export type ResizableShapeKind =
  | "rectangle"
  | "circle"
  | "frame"
  | "text"
  | "image"
  | "terminal"
  | "browser";
export type ShapeCategory = "Drawing" | "C4" | "Application" | "Data" | "Platform";
export type Point = { x: number; y: number };
export type ResizeHandle = "nw" | "ne" | "se" | "sw";
export type ConnectorHandle = "start" | "control" | "end";

export type ArchitectureNode = ArchitectureDiagramNode & {
  rotation?: number;
  connectorStartId?: string;
  connectorEndId?: string;
  textAnchorId?: string;
  frameId?: string;
};
export type ArchitectureEdge = ArchitectureDiagramEdge;

export type ShapeConfig = {
  kind: ShapeKind;
  label: string;
  category: ShapeCategory;
  description: string;
  icon: typeof WorkflowSquare01Icon;
  tone: string;
  mode?: CanvasMode;
};

export type DragState = {
  id: string;
  dx: number;
  dy: number;
  sourceBounds?: TerminalDockRect;
  terminalGroupId?: string;
};

export type TerminalDropPreview = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DrawingState = {
  id: string;
  kind: ShapeDrawingMode;
  start: Point;
};

export type ResizeState = {
  id: string;
  handle: ResizeHandle;
  startNode: ArchitectureNode;
  terminalGroupId?: string;
};

export type RotateState = {
  id: string;
  center: Point;
};

export type ConnectorHandleState = {
  id: string;
  handle: ConnectorHandle;
};

export type HistorySnapshot = {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  nextNode: number;
  nextEdge: number;
};

export type ArchitectureCanvasProps = {
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
  onRegisterTerminalCreator?: (
    tabId: number,
    creator: ((initialCommand?: string) => boolean) | null,
  ) => void;
  canvasFocused?: boolean;
  onToggleCanvasFocus?: () => void;
};

export type ResizePointerHandler = (
  event: ReactPointerEvent<SVGRectElement>,
  node: ArchitectureNode,
  handle: ResizeHandle,
) => void;

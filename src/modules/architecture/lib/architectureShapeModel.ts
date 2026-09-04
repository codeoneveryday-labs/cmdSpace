import type {
  ArchitectureNode,
  Point,
  ResizeHandle,
  ResizeState,
  RotateState,
  ShapeKind,
} from "./architectureCanvasTypes";

export const NODE_WIDTH = 176;
export const NODE_HEIGHT = 82;
export const TERMINAL_DEFAULT_SIZE = { width: 640, height: 400 };
export const INTERACTIVE_SURFACE_DEFAULT_SIZE = { width: 720, height: 480 };
export const INTERACTIVE_SURFACE_MINIMUM_SIZE = { width: 400, height: 300 };

export function resizeShapeNode(
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

export function updateResizedNode(
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

export function updateRotatingNode(
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

export function normalizeDragRect(
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

export function normalizeResizeRect(
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

export function normalizeRotation(value: number): number {
  return Math.round(((value % 360) + 360) % 360);
}

export function defaultSize(kind: ShapeKind): { width: number; height: number } {
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
    case "editor":
      return INTERACTIVE_SURFACE_DEFAULT_SIZE;
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

export function minimumDrawingSize(kind: ShapeKind): { width: number; height: number } {
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
    case "editor":
      return INTERACTIVE_SURFACE_MINIMUM_SIZE;
    case "rectangle":
      return { width: 40, height: 32 };
    default:
      return { width: 1, height: 1 };
  }
}

import type {
  ArchitectureEdge,
  ArchitectureNode,
  LiveSurfaceKind,
  Point,
  ShapeKind,
} from "./architectureCanvasTypes";
import {
  clamp,
  defaultSize,
  defaultTechnology,
  isResizableShapeKind,
  minimumDrawingSize,
} from "./architectureCanvasModel";
import { shapeFor } from "./architectureShapeCatalog";

export function node(
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

export function edge(
  id: string,
  from: string,
  to: string,
  label: string,
): ArchitectureEdge {
  return { id, from, to, label };
}

export function createCanvasNode({
  id,
  kind,
  point,
  bounds,
  fromDrag = false,
}: {
  id: string;
  kind: ShapeKind;
  point: Point;
  bounds: { x: number; y: number; width: number; height: number };
  fromDrag?: boolean;
}): ArchitectureNode {
  const size = defaultSize(kind);
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

export function createSurfaceNode({
  id,
  kind,
  x,
  y,
  width,
  height,
  cwd,
  initialCommand,
  frameId,
}: {
  id: string;
  kind: LiveSurfaceKind;
  x: number;
  y: number;
  width: number;
  height: number;
  cwd?: string;
  initialCommand?: string;
  frameId?: string;
}): ArchitectureNode {
  return node(
    id,
    kind,
    shapeFor(kind).label,
    defaultTechnology(kind),
    x,
    y,
    width,
    height,
    {
      ...(kind === "terminal" ? { terminalChromeVersion: 2 as const } : {}),
      ...(kind === "terminal" && cwd ? { cwd } : {}),
      ...(kind === "terminal" && initialCommand ? { initialCommand } : {}),
      ...(kind === "browser" ? { url: "" } : {}),
      ...(frameId ? { frameId } : {}),
    },
  );
}

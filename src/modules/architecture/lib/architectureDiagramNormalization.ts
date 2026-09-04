import { TERMINAL_DEFAULT_SIZE } from "./architectureShapeModel";
import { isLiveSurfaceNode } from "./architectureCanvasPredicates";
import { ARCHITECTURE_SHAPES } from "./architectureShapeCatalog";
import {
  normalizeTerminalDockGroups,
} from "../terminalDockLayout";
import type {
  ArchitectureDiagram,
  ArchitectureEdge,
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
  Point,
  ShapeKind,
} from "./architectureCanvasTypes";

export const LEGACY_TERMINAL_SIZE = { width: 420, height: 280 };

export function needsTerminalSizeMigration(item: Partial<ArchitectureNode>): boolean {
  if (item.kind !== "terminal" || item.terminalChromeVersion === 2) return false;
  if (
    item.width === LEGACY_TERMINAL_SIZE.width &&
    item.height === LEGACY_TERMINAL_SIZE.height
  ) {
    return true;
  }
  return (
    typeof item.width === "number" &&
    typeof item.height === "number" &&
    item.width / item.height < 1.2
  );
}

export function normalizeDiagramSeed(seed?: ArchitectureDiagram): {
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
    const item = rawNode as unknown as Record<string, unknown>;
    const kind = item.kind;
    if (
      typeof item.id !== "string" ||
      nodeIds.has(item.id) ||
      typeof kind !== "string" ||
      kind === "browser" ||
      !validKinds.has(kind as ShapeKind) ||
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
      ...(typeof item.path === "string" ? { path: item.path } : {}),
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
      nodes.filter(isLiveSurfaceNode),
      seed?.terminalDockGroups,
    ),
  };
}

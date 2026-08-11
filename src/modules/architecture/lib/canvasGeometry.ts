export type CanvasPoint = { x: number; y: number };

export type CanvasGeometryNode = {
  id: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  points?: CanvasPoint[];
  connectorStartId?: string;
  connectorEndId?: string;
};

const EDGE_NODE_OVERLAP = 4;

export function nodeTransform(node: CanvasGeometryNode): string {
  return `translate(${node.x} ${node.y}) rotate(${node.rotation ?? 0} ${node.width / 2} ${node.height / 2})`;
}

export function edgeAnchorPoint(
  source: CanvasGeometryNode,
  target: CanvasGeometryNode,
  enterTarget: boolean,
): CanvasPoint {
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

export function nodeCenter(
  node: Pick<CanvasGeometryNode, "x" | "y" | "width" | "height">,
): CanvasPoint {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

export function pointInsideNode(point: CanvasPoint, node: CanvasGeometryNode): boolean {
  return (
    point.x >= node.x &&
    point.x <= node.x + node.width &&
    point.y >= node.y &&
    point.y <= node.y + node.height
  );
}

export function boundaryPoint(
  source: CanvasGeometryNode,
  target: CanvasPoint,
): CanvasPoint {
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

export function connectorControlPoint(node: CanvasGeometryNode): CanvasPoint {
  return node.points?.[0] ?? { x: node.width / 2, y: node.height / 2 };
}

export function connectorAbsoluteControl(node: CanvasGeometryNode): CanvasPoint {
  const control = connectorControlPoint(node);
  return { x: node.x + control.x, y: node.y + control.y };
}

export function connectorPath(node: CanvasGeometryNode): string {
  const control = connectorControlPoint(node);
  return `M 0 0 Q ${control.x} ${control.y}, ${node.width} ${node.height}`;
}

export function resolveConnectorNode<T extends CanvasGeometryNode>(
  item: T,
  nodes: CanvasGeometryNode[],
): T {
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

export function connectorGeometry(
  item: CanvasGeometryNode,
  nodes: CanvasGeometryNode[],
): { start: CanvasPoint; control: CanvasPoint; end: CanvasPoint } {
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

export function snapConnectorEndpoint(
  point: CanvasPoint,
  connector: CanvasGeometryNode,
  nodes: CanvasGeometryNode[],
  snapDistance: number,
): { nodeId: string; point: CanvasPoint } | null {
  let nearest: { node: CanvasGeometryNode; distance: number } | null = null;
  for (const node of nodes) {
    if (node.id === connector.id || isDrawingOnlyKind(node.kind)) continue;
    const nextDistance = distance(point, boundaryPoint(node, point));
    if (nextDistance > snapDistance) continue;
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

export function isConnectorKind(kind: string): boolean {
  return kind === "line" || kind === "arrow";
}

function isDrawingOnlyKind(kind: string): boolean {
  return kind === "line" || kind === "arrow" || kind === "pen";
}

function distance(a: CanvasPoint, b: CanvasPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

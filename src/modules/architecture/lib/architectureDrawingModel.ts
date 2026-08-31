import { snapConnectorEndpoint } from "./canvasGeometry";
import type {
  ArchitectureNode,
  DrawingState,
  Point,
} from "./architectureCanvasTypes";
import { isResizableShapeKind } from "./architectureCanvasPredicates";
import { resizeShapeNode } from "./architectureShapeModel";
import { CONNECTOR_SNAP_DISTANCE } from "./architectureConnectorModel";
import { distance } from "./architectureSurfaceModel";

export function updateDrawingNode(
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
    const startSnap = snapConnectorEndpoint(
      drawing.start,
      item,
      nodes,
      CONNECTOR_SNAP_DISTANCE,
    );
    const endSnap = snapConnectorEndpoint(
      point,
      item,
      nodes,
      CONNECTOR_SNAP_DISTANCE,
    );
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

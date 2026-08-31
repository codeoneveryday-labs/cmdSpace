import { connectorGeometry, snapConnectorEndpoint } from "./canvasGeometry";
import type {
  ArchitectureNode,
  ConnectorHandleState,
  Point,
} from "./architectureCanvasTypes";

export const CONNECTOR_SNAP_DISTANCE = 28;

export function updateConnectorHandle(
  item: ArchitectureNode,
  connector: ConnectorHandleState,
  point: Point,
  nodes: ArchitectureNode[],
): ArchitectureNode {
  const geometry = connectorGeometry(item, nodes);
  const snap = snapConnectorEndpoint(
    point,
    item,
    nodes,
    CONNECTOR_SNAP_DISTANCE,
  );
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

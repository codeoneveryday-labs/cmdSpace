import {
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
  ConnectorHandle,
  ConnectorHandleState,
  DragState,
  DrawingState,
  Point,
  ResizeHandle,
  ResizeState,
  RotateState,
} from "./architectureCanvasTypes";
import {
  cloneNode,
  isLiveSurfaceKind,
  isResizableShapeKind,
  updateConnectorHandle,
  updateDrawingNode,
  updateResizedNode,
  updateRotatingNode,
} from "./architectureCanvasModel";
import { isConnectorKind } from "../lib/canvasGeometry";
import type { TerminalDockStackLayout } from "../terminalDockLayout";

type ClientPoint = { clientX: number; clientY: number };
type GroupBounds = Pick<ArchitectureTerminalDockGroup, "x" | "y" | "width" | "height">;

export function useCanvasShapeGestures({
  terminalDockGroups,
  terminalLayoutById,
  svgRef,
  svgPointFromClient,
  setNodes,
  setTerminalDockGroups,
  setDrag,
  setConnectSourceId,
  pushHistory,
  selectSingleNode,
  updateTerminalGroupBounds,
}: {
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  terminalLayoutById: ReadonlyMap<string, TerminalDockStackLayout>;
  svgRef: RefObject<SVGSVGElement | null>;
  svgPointFromClient: (point: ClientPoint) => Point;
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  setTerminalDockGroups: Dispatch<SetStateAction<ArchitectureTerminalDockGroup[]>>;
  setDrag: Dispatch<SetStateAction<DragState | null>>;
  setConnectSourceId: (id: string | null) => void;
  pushHistory: () => void;
  selectSingleNode: (id: string) => void;
  updateTerminalGroupBounds: (
    groups: ArchitectureTerminalDockGroup[],
    groupId: string,
    bounds: GroupBounds,
  ) => ArchitectureTerminalDockGroup[];
}) {
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [rotate, setRotate] = useState<RotateState | null>(null);
  const [connectorHandle, setConnectorHandle] =
    useState<ConnectorHandleState | null>(null);

  const clear = () => {
    setDrawing(null);
    setResize(null);
    setRotate(null);
    setConnectorHandle(null);
  };

  const capturePointer = (event: ReactPointerEvent<SVGElement>) => {
    svgRef.current?.setPointerCapture(event.pointerId);
  };

  const beginDrawing = (
    nextDrawing: DrawingState,
    event: ReactPointerEvent<SVGSVGElement>,
  ) => {
    setResize(null);
    setRotate(null);
    setConnectorHandle(null);
    setDrawing(nextDrawing);
    capturePointer(event);
  };

  const beginResize = (
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
    const terminalLayout = isLiveSurfaceKind(item.kind)
      ? terminalLayoutById.get(item.id)
      : undefined;
    const terminalGroup = terminalLayout
      ? terminalDockGroups.find((group) => group.id === terminalLayout.groupId)
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
    capturePointer(event);
  };

  const beginRotate = (
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
    capturePointer(event);
  };

  const beginConnector = (
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
    capturePointer(event);
  };

  const updatePointer = (event: ReactPointerEvent<SVGSVGElement>): boolean => {
    const point = svgPointFromClient(event);
    if (drawing) {
      setNodes((current) =>
        current.map((item) =>
          item.id === drawing.id
            ? updateDrawingNode(item, drawing, point, current)
            : item,
        ),
      );
      return true;
    }
    if (resize) {
      if (resize.terminalGroupId) {
        const resized = updateResizedNode(resize.startNode, resize, point);
        setTerminalDockGroups((current) =>
          updateTerminalGroupBounds(current, resize.terminalGroupId!, {
            x: resized.x,
            y: resized.y,
            width: resized.width,
            height: resized.height,
          }),
        );
      } else {
        setNodes((current) =>
          current.map((item) =>
            item.id === resize.id && !item.locked
              ? updateResizedNode(item, resize, point)
              : item,
          ),
        );
      }
      return true;
    }
    if (rotate) {
      setNodes((current) =>
        current.map((item) =>
          item.id === rotate.id && !item.locked
            ? updateRotatingNode(item, rotate, point)
            : item,
        ),
      );
      return true;
    }
    if (connectorHandle) {
      setNodes((current) =>
        current.map((item) =>
          item.id === connectorHandle.id && !item.locked
            ? updateConnectorHandle(item, connectorHandle, point, current)
            : item,
        ),
      );
      return true;
    }
    return false;
  };

  return {
    drawing,
    resize,
    rotate,
    connectorHandle,
    beginDrawing,
    beginResize,
    beginRotate,
    beginConnector,
    updatePointer,
    clear,
  };
}

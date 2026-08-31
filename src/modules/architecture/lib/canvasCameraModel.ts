import type { CanvasView } from "./useCanvasCamera";

export const VIEWBOX_WIDTH = 1200;
export const VIEWBOX_HEIGHT = 720;
export const MIN_ZOOM = 0.55;
export const MAX_ZOOM = 1.8;
export const CANVAS_PAN_MARGIN_RATIO = 0.75;
export const TRACKPAD_PAN_SENSITIVITY = 0.35;

type CanvasSize = { width: number; height: number };
type ViewportPoint = { x: number; y: number };
type ClientPoint = { clientX: number; clientY: number };
type ClientRectLike = { left: number; top: number; width: number; height: number };

export function canvasPointFromClient(
  point: ClientPoint,
  rect: ClientRectLike,
  view: CanvasView,
  canvasSize: CanvasSize = { width: rect.width, height: rect.height },
): ViewportPoint {
  const viewWidth = canvasSize.width / view.scale;
  const viewHeight = canvasSize.height / view.scale;
  return {
    x: view.x + ((point.clientX - rect.left) / Math.max(rect.width, 1)) * viewWidth,
    y: view.y + ((point.clientY - rect.top) / Math.max(rect.height, 1)) * viewHeight,
  };
}

export function zoomCanvasViewAtPoint(
  current: CanvasView,
  canvasSize: CanvasSize,
  localPoint: ViewportPoint,
  deltaY: number,
): CanvasView {
  const currentWidth = canvasSize.width / current.scale;
  const currentHeight = canvasSize.height / current.scale;
  const focal = {
    x: current.x + localPoint.x * currentWidth,
    y: current.y + localPoint.y * currentHeight,
  };
  const nextScale = clamp(
    current.scale * Math.exp(-deltaY * 0.002),
    MIN_ZOOM,
    MAX_ZOOM,
  );
  const nextWidth = canvasSize.width / nextScale;
  const nextHeight = canvasSize.height / nextScale;
  return clampCanvasView(
    {
      scale: nextScale,
      x: focal.x - localPoint.x * nextWidth,
      y: focal.y - localPoint.y * nextHeight,
    },
    canvasSize,
  );
}

export function centerCanvasView(
  current: CanvasView,
  canvasSize: CanvasSize,
  scale: number,
): CanvasView {
  const centerX = current.x + canvasSize.width / current.scale / 2;
  const centerY = current.y + canvasSize.height / current.scale / 2;
  const width = canvasSize.width / scale;
  const height = canvasSize.height / scale;
  return clampCanvasView(
    { scale, x: centerX - width / 2, y: centerY - height / 2 },
    canvasSize,
  );
}

export function clampCanvasView(current: CanvasView, canvasSize: CanvasSize): CanvasView {
  const width = canvasSize.width / current.scale;
  const height = canvasSize.height / current.scale;
  return {
    scale: current.scale,
    x: clampCanvasCoord(current.x, width, VIEWBOX_WIDTH, canvasSize.width),
    y: clampCanvasCoord(current.y, height, VIEWBOX_HEIGHT, canvasSize.height),
  };
}

export function clampCanvasCoord(
  value: number,
  viewportSize: number,
  canvasSize: number,
  canvasPixels: number,
): number {
  const slack = canvasPanMargin(viewportSize, canvasPixels);
  const min = -slack;
  const max = Math.max(canvasSize - viewportSize, 0) + slack;
  return clamp(value, min, max);
}

export function canvasPanMargin(viewportSize: number, canvasPixels: number): number {
  return Math.max(viewportSize, canvasPixels / MIN_ZOOM) * CANVAS_PAN_MARGIN_RATIO;
}

export function wheelPanDelta(
  event: { deltaMode: number; deltaX: number; deltaY: number },
): ViewportPoint {
  const multiplier = event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? 240 : 1;
  return {
    x: event.deltaX * multiplier * TRACKPAD_PAN_SENSITIVITY,
    y: event.deltaY * multiplier * TRACKPAD_PAN_SENSITIVITY,
  };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

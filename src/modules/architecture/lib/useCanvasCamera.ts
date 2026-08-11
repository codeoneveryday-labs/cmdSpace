import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
} from "react";

import { panViewFromPointer, type PanStart } from "../canvasPan";
import { terminalWorldTransform } from "../canvasCoordinates";

const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 720;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.8;
const CANVAS_PAN_MARGIN_RATIO = 0.75;
const TRACKPAD_PAN_SENSITIVITY = 0.35;

export type CanvasView = {
  x: number;
  y: number;
  scale: number;
};

type CanvasSize = {
  width: number;
  height: number;
};

type ViewportPoint = {
  x: number;
  y: number;
};

type ViewRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ClientPoint = {
  clientX: number;
  clientY: number;
};

type ClientRectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type UseCanvasCameraOptions = {
  appZoom: number;
  svgRef: RefObject<SVGSVGElement | null>;
  terminalWorldRef: RefObject<HTMLDivElement | null>;
};

export function useCanvasCamera({
  appZoom,
  svgRef,
  terminalWorldRef,
}: UseCanvasCameraOptions) {
  const promotionTimerRef = useRef<number | null>(null);
  const [pan, setPan] = useState<PanStart | null>(null);
  const [view, setView] = useState<CanvasView>({ x: 0, y: 0, scale: 1 });
  const [canvasSize, setCanvasSize] = useState<CanvasSize>({
    width: VIEWBOX_WIDTH,
    height: VIEWBOX_HEIGHT,
  });

  const viewWidth = canvasSize.width / view.scale;
  const viewHeight = canvasSize.height / view.scale;
  const terminalTransform = terminalWorldTransform(view, appZoom);

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
  }, [svgRef]);

  useEffect(() => {
    setView((current) => clampCanvasView(current, canvasSize));
  }, [canvasSize.height, canvasSize.width]);

  useEffect(() => {
    promotionTimerRef.current = window.setTimeout(() => {
      promotionTimerRef.current = null;
      if (terminalWorldRef.current) {
        terminalWorldRef.current.style.willChange = "auto";
      }
    }, 150);
    return () => {
      if (promotionTimerRef.current !== null) {
        window.clearTimeout(promotionTimerRef.current);
      }
    };
  }, [terminalWorldRef]);

  const promoteTerminalWorld = () => {
    const terminalWorld = terminalWorldRef.current;
    if (!terminalWorld) return;
    terminalWorld.style.willChange = "transform";
    if (promotionTimerRef.current !== null) {
      window.clearTimeout(promotionTimerRef.current);
    }
    promotionTimerRef.current = window.setTimeout(() => {
      promotionTimerRef.current = null;
      if (terminalWorldRef.current) {
        terminalWorldRef.current.style.willChange = "auto";
      }
    }, 150);
  };

  const startPan = (event: Pick<ReactPointerEvent, "clientX" | "clientY">) => {
    setPan({
      clientX: event.clientX,
      clientY: event.clientY,
      viewX: view.x,
      viewY: view.y,
    });
  };

  const panFromPointer = (
    event: Pick<ReactPointerEvent, "clientX" | "clientY">,
  ) => {
    if (!pan) return;
    setView((current) =>
      clampCanvasView(
        {
          ...current,
          ...panViewFromPointer(pan, event, current.scale),
        },
        canvasSize,
      ),
    );
  };

  const stopPan = () => setPan(null);

  const svgPointFromClient = (point: ClientPoint): ViewportPoint => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    return canvasPointFromClient(point, svg.getBoundingClientRect(), view, canvasSize);
  };

  const clampView = (current: CanvasView, scale = current.scale) =>
    clampCanvasView({ ...current, scale }, canvasSize);

  const centerView = (current: CanvasView, scale: number) =>
    centerCanvasView(current, canvasSize, scale);

  const centerViewOnPlacement = (
    current: CanvasView,
    placement: ViewRect,
  ): CanvasView => {
    const width = canvasSize.width / current.scale;
    const height = canvasSize.height / current.scale;
    const centerX = placement.x + placement.width / 2;
    const centerY = placement.y + placement.height / 2;
    const next = {
      ...current,
      x: centerX - width / 2,
      y: centerY - height / 2,
    };

    const clampedX =
      placement.width >= width
        ? next.x
        : clampCanvasCoord(next.x, width, VIEWBOX_WIDTH, canvasSize.width);
    const clampedY =
      placement.height >= height
        ? next.y
        : clampCanvasCoord(next.y, height, VIEWBOX_HEIGHT, canvasSize.height);
    return { ...next, x: clampedX, y: clampedY };
  };

  const drawableBounds = () => {
    const x = Math.min(0, view.x);
    const y = Math.min(0, view.y);
    return {
      x,
      y,
      width: Math.max(VIEWBOX_WIDTH, view.x + viewWidth) - x,
      height: Math.max(VIEWBOX_HEIGHT, view.y + viewHeight) - y,
    };
  };

  const handleWheel = (event: ReactWheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    promoteTerminalWorld();
    if (!event.ctrlKey && !event.metaKey) {
      const delta = wheelPanDelta(event);
      setView((current) =>
        clampCanvasView(
          {
            ...current,
            x: current.x + delta.x / current.scale,
            y: current.y + delta.y / current.scale,
          },
          canvasSize,
        ),
      );
      return;
    }

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const localPoint = {
      x: (event.clientX - rect.left) / Math.max(rect.width, 1),
      y: (event.clientY - rect.top) / Math.max(rect.height, 1),
    };
    setView((current) =>
      zoomCanvasViewAtPoint(current, canvasSize, localPoint, event.deltaY),
    );
  };

  const zoomBy = (delta: number) => {
    promoteTerminalWorld();
    setView((current) => {
      const nextScale = clamp(current.scale + delta, MIN_ZOOM, MAX_ZOOM);
      return centerView(current, nextScale);
    });
  };

  return {
    canvasSize,
    centerView,
    centerViewOnPlacement,
    clampView,
    drawableBounds,
    handleWheel,
    pan,
    panFromPointer,
    setView,
    startPan,
    stopPan,
    svgPointFromClient,
    terminalTransform,
    view,
    viewHeight,
    viewWidth,
    zoomBy,
  };
}

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
    {
      scale,
      x: centerX - width / 2,
      y: centerY - height / 2,
    },
    canvasSize,
  );
}

export function clampCanvasView(
  current: CanvasView,
  canvasSize: CanvasSize,
): CanvasView {
  const width = canvasSize.width / current.scale;
  const height = canvasSize.height / current.scale;
  return {
    scale: current.scale,
    x: clampCanvasCoord(current.x, width, VIEWBOX_WIDTH, canvasSize.width),
    y: clampCanvasCoord(current.y, height, VIEWBOX_HEIGHT, canvasSize.height),
  };
}

function clampCanvasCoord(
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

function canvasPanMargin(viewportSize: number, canvasPixels: number): number {
  return Math.max(viewportSize, canvasPixels / MIN_ZOOM) * CANVAS_PAN_MARGIN_RATIO;
}

function wheelPanDelta(
  event: Pick<ReactWheelEvent<SVGSVGElement>, "deltaMode" | "deltaX" | "deltaY">,
): ViewportPoint {
  const multiplier = event.deltaMode === 1 ? 24 : event.deltaMode === 2 ? 240 : 1;
  return {
    x: event.deltaX * multiplier * TRACKPAD_PAN_SENSITIVITY,
    y: event.deltaY * multiplier * TRACKPAD_PAN_SENSITIVITY,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

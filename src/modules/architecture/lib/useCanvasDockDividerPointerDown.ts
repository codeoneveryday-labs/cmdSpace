import type { PointerEvent as ReactPointerEvent } from "react";
import type { TerminalDockDividerLayout } from "../terminalDockLayout";

export function useCanvasDockDividerPointerDown({
  pushHistory,
  setDrag,
  clearShapeGestures,
  beginDockDividerResize,
  svgPointFromClient,
}: {
  pushHistory: () => void;
  setDrag: (value: null) => void;
  clearShapeGestures: () => void;
  beginDockDividerResize: (
    divider: TerminalDockDividerLayout,
    point: { x: number; y: number },
  ) => void;
  svgPointFromClient: (point: { clientX: number; clientY: number }) => {
    x: number;
    y: number;
  };
}) {
  return (
    event: ReactPointerEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    pushHistory();
    setDrag(null);
    clearShapeGestures();
    beginDockDividerResize(divider, svgPointFromClient(event));
    event.currentTarget.setPointerCapture(event.pointerId);
  };
}

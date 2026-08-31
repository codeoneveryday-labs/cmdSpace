import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export const MIN_BOTTOM_TERMINAL_HEIGHT = 160;
export const MAX_BOTTOM_TERMINAL_HEIGHT = 560;

export function useBottomTerminalResize({
  height,
  onHeightChange,
}: {
  height: number;
  onHeightChange: (height: number) => void;
}) {
  const resizeRef = useRef<{
    pointerId: number;
    startY: number;
    startHeight: number;
  } | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const pendingHeightRef = useRef<number | null>(null);
  const [resizing, setResizing] = useState(false);

  const flushResize = useCallback(() => {
    resizeFrameRef.current = null;
    const nextHeight = pendingHeightRef.current;
    pendingHeightRef.current = null;
    if (nextHeight !== null) onHeightChange(nextHeight);
  }, [onHeightChange]);

  const handleResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: height,
    };
    setResizing(true);
  }, [height]);

  const handleResizeMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = resizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    const viewportMax = Math.max(
      MIN_BOTTOM_TERMINAL_HEIGHT,
      window.innerHeight - 140,
    );
    pendingHeightRef.current = Math.min(
      Math.min(MAX_BOTTOM_TERMINAL_HEIGHT, viewportMax),
      Math.max(
        MIN_BOTTOM_TERMINAL_HEIGHT,
        resize.startHeight + resize.startY - event.clientY,
      ),
    );
    if (resizeFrameRef.current === null) {
      resizeFrameRef.current = requestAnimationFrame(flushResize);
    }
  }, [flushResize]);

  const handleResizeEnd = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId !== event.pointerId) return;
    if (resizeFrameRef.current !== null) {
      cancelAnimationFrame(resizeFrameRef.current);
      flushResize();
    }
    resizeRef.current = null;
    setResizing(false);
  }, [flushResize]);

  return { resizing, handleResizeStart, handleResizeMove, handleResizeEnd };
}

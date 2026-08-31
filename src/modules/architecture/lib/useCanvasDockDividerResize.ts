import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import {
  updateTerminalDockSplitRatio,
  type TerminalDockDividerLayout,
} from "../terminalDockLayout";
import { clampDockDividerRatio, dockDividerKeyboardDelta } from "./canvasDockDividerModel";
import type { ArchitectureTerminalDockGroup } from "@/modules/tabs";

type Point = { x: number; y: number };
type ResizeState = { divider: TerminalDockDividerLayout; start: Point; ratio: number };

export function useCanvasDockDividerResize({
  setTerminalDockGroups,
  svgPointFromClient,
}: {
  setTerminalDockGroups: Dispatch<SetStateAction<ArchitectureTerminalDockGroup[]>>;
  svgPointFromClient: (event: { clientX: number; clientY: number }) => Point;
}) {
  const [dockDividerResize, setDockDividerResize] = useState<ResizeState | null>(null);
  const dockDividerResizeFrameRef = useRef<number | null>(null);
  const pendingDockDividerRatioRef = useRef<{
    divider: TerminalDockDividerLayout;
    ratio: number;
  } | null>(null);

  const flushDockDividerResize = () => {
    const pending = pendingDockDividerRatioRef.current;
    pendingDockDividerRatioRef.current = null;
    if (!pending) return;
    setTerminalDockGroups((current) =>
      updateTerminalDockSplitRatio(
        current,
        pending.divider.groupId,
        pending.divider.splitId,
        pending.ratio,
      ),
    );
  };

  const updateDockDividerRatio = (divider: TerminalDockDividerLayout, ratio: number) => {
    pendingDockDividerRatioRef.current = {
      divider,
      ratio: clampDockDividerRatio(ratio),
    };
    if (dockDividerResizeFrameRef.current !== null) return;
    dockDividerResizeFrameRef.current = requestAnimationFrame(() => {
      dockDividerResizeFrameRef.current = null;
      flushDockDividerResize();
    });
  };

  useEffect(
    () => () => {
      if (dockDividerResizeFrameRef.current !== null) {
        cancelAnimationFrame(dockDividerResizeFrameRef.current);
      }
    },
    [],
  );

  const beginDockDividerResize = (divider: TerminalDockDividerLayout, start: Point) => {
    setDockDividerResize({ divider, start, ratio: divider.ratio });
  };

  const handleDockDividerPointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
  ) => {
    const resizing = dockDividerResize;
    if (
      !resizing ||
      resizing.divider.groupId !== divider.groupId ||
      resizing.divider.splitId !== divider.splitId
    ) {
      return;
    }
    const point = svgPointFromClient(event);
    const axisDelta =
      divider.direction === "horizontal"
        ? point.x - resizing.start.x
        : point.y - resizing.start.y;
    const axisLength =
      divider.direction === "horizontal"
        ? resizing.divider.rect.width
        : resizing.divider.rect.height;
    if (axisLength <= 0) return;
    updateDockDividerRatio(divider, resizing.ratio + axisDelta / axisLength);
  };

  const finishDockDividerResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (dockDividerResizeFrameRef.current !== null) {
      cancelAnimationFrame(dockDividerResizeFrameRef.current);
      dockDividerResizeFrameRef.current = null;
    }
    flushDockDividerResize();
    setDockDividerResize(null);
  };

  const handleDockDividerKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
    onBeforeChange: () => void,
  ) => {
    const delta = dockDividerKeyboardDelta({
      direction: divider.direction,
      key: event.key,
      shiftKey: event.shiftKey,
    });
    if (delta === null) return;
    event.preventDefault();
    event.stopPropagation();
    onBeforeChange();
    updateDockDividerRatio(divider, divider.ratio + delta);
  };

  return {
    beginDockDividerResize,
    finishDockDividerResize,
    handleDockDividerKeyDown,
    handleDockDividerPointerMove,
    terminalResizePaused: Boolean(dockDividerResize),
  };
}

import type {
  ArchitectureDiagramNode,
  ArchitectureTerminalDockGroup,
} from "@/modules/tabs";
import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  SetStateAction,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  projectTerminalDockLayouts,
  resolveTerminalDockDrop,
  terminalDockIndicatorRect,
  updateTerminalDockSplitRatio,
  type TerminalDockDividerLayout,
  type TerminalDockDropTarget,
  type TerminalDockStackLayout,
} from "../terminalDockLayout";

type Point = { x: number; y: number };

type DockDividerResizeState = {
  divider: TerminalDockDividerLayout;
  start: Point;
  ratio: number;
};

type UseCanvasDockingArgs = {
  nodes: ArchitectureDiagramNode[];
  terminalNodes: ArchitectureDiagramNode[];
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  terminalLayouts: TerminalDockStackLayout[];
  resizeTerminalGroupId?: string;
  view: { x: number; y: number };
  viewWidth: number;
  viewHeight: number;
  svgRef: RefObject<SVGSVGElement | null>;
  svgPointFromClient: (event: { clientX: number; clientY: number }) => Point;
  setTerminalDockGroups: Dispatch<
    SetStateAction<ArchitectureTerminalDockGroup[]>
  >;
};

type ClientPoint = { x: number; y: number };

function clampDockDividerRatio(ratio: number) {
  return Math.max(0.1, Math.min(0.9, ratio));
}

export function useCanvasDocking({
  nodes,
  terminalNodes,
  terminalDockGroups,
  terminalLayouts,
  resizeTerminalGroupId,
  view,
  viewWidth,
  viewHeight,
  svgRef,
  svgPointFromClient,
  setTerminalDockGroups,
}: UseCanvasDockingArgs) {
  const [terminalDockDropTarget, setTerminalDockDropTarget] =
    useState<TerminalDockDropTarget | null>(null);
  const terminalDockDropTargetRef = useRef<TerminalDockDropTarget | null>(null);
  const [dockDividerResize, setDockDividerResize] =
    useState<DockDividerResizeState | null>(null);
  const dockDividerResizeFrameRef = useRef<number | null>(null);
  const pendingDockDividerRatioRef = useRef<{
    divider: TerminalDockDividerLayout;
    ratio: number;
  } | null>(null);

  const terminalPlacementObstacles = useMemo(() => {
    const dockedTerminalIds = new Set(
      terminalLayouts.flatMap((layout) => layout.terminalIds),
    );
    return [
      ...nodes
        .filter((node) => node.kind !== "terminal")
        .map(({ x, y, width, height }) => ({ x, y, width, height })),
      ...terminalDockGroups.map(({ x, y, width, height }) => ({
        x,
        y,
        width,
        height,
      })),
      ...terminalNodes
        .filter((node) => !dockedTerminalIds.has(node.id))
        .map(({ x, y, width, height }) => ({ x, y, width, height })),
    ];
  }, [nodes, terminalDockGroups, terminalLayouts, terminalNodes]);

  const terminalDockIndicator = terminalDockDropTarget
    ? terminalDockIndicatorRect(terminalDockDropTarget, terminalLayouts)
    : null;
  const terminalResizePaused = Boolean(
    dockDividerResize || resizeTerminalGroupId,
  );

  const updateTerminalDockDropTarget = (
    target: TerminalDockDropTarget | null,
  ) => {
    terminalDockDropTargetRef.current = target;
    setTerminalDockDropTarget(target);
  };

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

  const updateDockDividerRatio = (
    divider: TerminalDockDividerLayout,
    ratio: number,
  ) => {
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

  const resolveTerminalDockDropTargetAtPoint = (
    point: ClientPoint,
    draggedTerminalId: string,
  ) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) {
      updateTerminalDockDropTarget(null);
      return null;
    }
    const clientLayouts = projectTerminalDockLayouts(
      terminalLayouts,
      { x: view.x, y: view.y, width: viewWidth, height: viewHeight },
      {
        x: svgRect.left,
        y: svgRect.top,
        width: svgRect.width,
        height: svgRect.height,
      },
    );
    const target = resolveTerminalDockDrop(point, clientLayouts, draggedTerminalId);
    updateTerminalDockDropTarget(target);
    return target;
  };

  const beginDockDividerResize = (
    divider: TerminalDockDividerLayout,
    start: Point,
  ) => {
    setDockDividerResize({
      divider,
      start,
      ratio: divider.ratio,
    });
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

  const finishDockDividerResize = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
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
    const step = event.shiftKey ? 0.1 : 0.05;
    const delta =
      divider.direction === "horizontal"
        ? event.key === "ArrowLeft"
          ? -step
          : event.key === "ArrowRight"
            ? step
            : null
        : event.key === "ArrowUp"
          ? -step
          : event.key === "ArrowDown"
            ? step
            : null;
    if (delta === null) return;
    event.preventDefault();
    event.stopPropagation();
    onBeforeChange();
    updateDockDividerRatio(divider, divider.ratio + delta);
  };

  return {
    beginDockDividerResize,
    clearTerminalDockDropTarget: () => updateTerminalDockDropTarget(null),
    finishDockDividerResize,
    getTerminalDockDropTarget: () => terminalDockDropTargetRef.current,
    handleDockDividerKeyDown,
    handleDockDividerPointerMove,
    resolveTerminalDockDropTargetAtPoint,
    terminalDockDropTarget,
    terminalDockIndicator,
    terminalPlacementObstacles,
    terminalResizePaused,
  };
}

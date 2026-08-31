import type {
  ArchitectureDiagramNode,
  ArchitectureTerminalDockGroup,
} from "@/modules/tabs";
import type {
  Dispatch,
  RefObject,
  SetStateAction,
} from "react";
import { useRef, useState } from "react";

import {
  terminalDockIndicatorRect,
  type TerminalDockDropTarget,
  type TerminalDockStackLayout,
} from "../terminalDockLayout";
import {
  buildTerminalPlacementObstacles,
  resolveCanvasDockTarget,
} from "./canvasDockingModel";
import { useCanvasDockDividerResize } from "./useCanvasDockDividerResize";

type Point = { x: number; y: number };

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
  const dividerResize = useCanvasDockDividerResize({
    setTerminalDockGroups,
    svgPointFromClient,
  });
  const terminalPlacementObstacles = buildTerminalPlacementObstacles({
    nodes,
    terminalNodes,
    terminalDockGroups,
    terminalLayouts,
  });

  const terminalDockIndicator = terminalDockDropTarget
    ? terminalDockIndicatorRect(terminalDockDropTarget, terminalLayouts)
    : null;
  const terminalResizePaused = Boolean(
    dividerResize.terminalResizePaused || resizeTerminalGroupId,
  );

  const updateTerminalDockDropTarget = (
    target: TerminalDockDropTarget | null,
  ) => {
    terminalDockDropTargetRef.current = target;
    setTerminalDockDropTarget(target);
  };

  const resolveTerminalDockDropTargetAtPoint = (
    point: ClientPoint,
    draggedTerminalId: string,
  ) => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) {
      updateTerminalDockDropTarget(null);
      return null;
    }
    const target = resolveCanvasDockTarget({
      point,
      terminalLayouts,
      draggedTerminalId,
      view,
      viewWidth,
      viewHeight,
      svgRect: {
        x: svgRect.left,
        y: svgRect.top,
        width: svgRect.width,
        height: svgRect.height,
      },
    });
    updateTerminalDockDropTarget(target);
    return target;
  };

  return {
    beginDockDividerResize: dividerResize.beginDockDividerResize,
    clearTerminalDockDropTarget: () => updateTerminalDockDropTarget(null),
    finishDockDividerResize: dividerResize.finishDockDividerResize,
    getTerminalDockDropTarget: () => terminalDockDropTargetRef.current,
    handleDockDividerKeyDown: dividerResize.handleDockDividerKeyDown,
    handleDockDividerPointerMove: dividerResize.handleDockDividerPointerMove,
    resolveTerminalDockDropTargetAtPoint,
    terminalDockDropTarget,
    terminalDockIndicator,
    terminalPlacementObstacles,
    terminalResizePaused,
  };
}

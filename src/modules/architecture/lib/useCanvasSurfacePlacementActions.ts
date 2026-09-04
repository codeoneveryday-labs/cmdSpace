import type {
  Dispatch,
  MutableRefObject,
  SetStateAction,
} from "react";
import type {
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
  CanvasMode,
  LiveSurfaceKind,
  Point,
} from "./architectureCanvasTypes";
import {
  createDockedSurfaceState,
  createSurfaceNode,
} from "./architectureDiagramSeed";
import {
  defaultSize,
  inheritedSurfaceCwd,
  surfacePlacementAnchor,
} from "./architectureCanvasModel";
import {
  recommendTerminalPlacements,
  type TerminalPlacement,
} from "../terminalPlacement";
import {
  normalizeTerminalDockGroups,
  type TerminalDockStackLayout,
} from "../terminalDockLayout";

export function useCanvasSurfacePlacementActions({
  liveSurfaceNodes,
  terminalNodes,
  activeTerminalId,
  selectedNode,
  maximizedTerminalId,
  terminalDockGroups,
  terminalPlacementObstacles,
  view,
  viewWidth,
  viewHeight,
  nextNodeRef,
  pendingTerminalCommandRef,
  createNode,
  pushHistory,
  clearSelection,
  setConnectSourceId,
  setMode,
  setNodes,
  setTerminalDockGroups,
  setActiveTerminalId,
  setMaximizedTerminalId,
  selectSingleNode,
  beginPlacement,
  resetPlacement,
}: {
  liveSurfaceNodes: ArchitectureNode[];
  terminalNodes: ArchitectureNode[];
  activeTerminalId: string;
  selectedNode: ArchitectureNode | null;
  maximizedTerminalId: string;
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  terminalPlacementObstacles: TerminalPlacement[];
  view: { x: number; y: number };
  viewWidth: number;
  viewHeight: number;
  nextNodeRef: MutableRefObject<number>;
  pendingTerminalCommandRef: MutableRefObject<string | undefined>;
  createNode: (kind: "terminal", point: Point) => ArchitectureNode;
  pushHistory: () => void;
  clearSelection: () => void;
  setConnectSourceId: Dispatch<SetStateAction<string | null>>;
  setMode: Dispatch<SetStateAction<CanvasMode>>;
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  setTerminalDockGroups: Dispatch<
    SetStateAction<ArchitectureTerminalDockGroup[]>
  >;
  setActiveTerminalId: (id: string) => void;
  setMaximizedTerminalId: (id: string) => void;
  selectSingleNode: (id: string) => void;
  beginPlacement: (
    kind: LiveSurfaceKind,
    placements: TerminalPlacement[],
    isFree?: boolean,
  ) => void;
  resetPlacement: () => void;
}) {
  const beginSurfacePlacement = (kind: LiveSurfaceKind) => {
    const anchor = surfacePlacementAnchor(
      liveSurfaceNodes,
      kind,
      activeTerminalId,
      selectedNode,
      { x: view.x, y: view.y, width: viewWidth, height: viewHeight },
    );
    clearSelection();
    setConnectSourceId(null);
    setMode("select");
    const placements = recommendTerminalPlacements(
      { x: view.x, y: view.y, width: viewWidth, height: viewHeight },
      terminalPlacementObstacles,
      anchor,
      defaultSize(kind),
    );
    beginPlacement(kind, placements, false);
  };

  const createDockedSurface = (
    target: Pick<TerminalDockStackLayout, "groupId" | "stackId" | "rect">,
    kind: "tab" | "split",
    source: ArchitectureNode,
    initialCommand?: string,
  ) => {
    pushHistory();
    const result = createDockedSurfaceState({
      id: `n${nextNodeRef.current++}`,
      source,
      target,
      dockKind: kind,
      liveSurfaceNodes,
      terminalDockGroups,
      initialCommand,
    });
    setNodes((current) => [...current, result.created]);
    setTerminalDockGroups((current) =>
      createDockedSurfaceState({
        id: result.created.id,
        source,
        target,
        dockKind: kind,
       liveSurfaceNodes,
         terminalDockGroups: current,
         initialCommand,
        created: result.created,
       }).terminalDockGroups,
    );
    if (maximizedTerminalId === source.id) {
      setMaximizedTerminalId(result.created.id);
    }
    if (result.created.kind === "terminal") {
      setActiveTerminalId(result.created.id);
    }
    selectSingleNode(result.created.id);
  };

  const inheritedCwd = () =>
    inheritedSurfaceCwd(terminalNodes, activeTerminalId, selectedNode);

  const commitSurfacePlacement = (
    kind: LiveSurfaceKind,
    placement: TerminalPlacement,
  ) => {
    pushHistory();
    const created = createSurfaceNode({
      id: `n${nextNodeRef.current++}`,
      kind,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      cwd: inheritedCwd(),
      initialCommand: pendingTerminalCommandRef.current,
    });
    setNodes((current) => [...current, created]);
    setTerminalDockGroups((current) => [
      ...current,
      ...normalizeTerminalDockGroups([created], undefined),
    ]);
    selectSingleNode(created.id);
    if (kind === "terminal") setActiveTerminalId(created.id);
    resetPlacement();
    pendingTerminalCommandRef.current = undefined;
  };

  const commitFreeSurfacePlacement = (kind: LiveSurfaceKind, point: Point) => {
    pushHistory();
    const created = {
      ...createNode(kind, point),
      ...(kind === "terminal" && inheritedCwd()
        ? { cwd: inheritedCwd() }
        : {}),
    };
    setNodes((current) => [...current, created]);
    selectSingleNode(created.id);
    if (kind === "terminal") setActiveTerminalId(created.id);
    resetPlacement();
  };

  return {
    beginSurfacePlacement,
    commitFreeSurfacePlacement,
    commitSurfacePlacement,
    createDockedSurface,
  };
}

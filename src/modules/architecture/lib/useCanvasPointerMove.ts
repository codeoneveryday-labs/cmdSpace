import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react";
import type {
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
  DragState,
  Point,
} from "./architectureCanvasTypes";
import type { TerminalDockStackLayout } from "../terminalDockLayout";
import {
  applyCanvasDragMove,
  isLiveSurfaceKind,
  resolveCanvasDragMove,
} from "./architectureCanvasModel";
import { terminalDockGroupUsesSharedHeader } from "../terminalDockLayout";

type Bounds = { x: number; y: number; width: number; height: number };
type SurfacePreview = Bounds & { id: string };

export function useCanvasPointerMove({
  panActive,
  drag,
  nodes,
  selectedNodeIds,
  terminalDockGroups,
  terminalLayouts,
  panFromPointer,
  updateShapeGesture,
  svgPointFromClient,
  drawableBounds,
  updateTerminalGroupBounds,
  resolveLiveSurfaceDockTarget,
  setTerminalDockGroups,
  setTerminalDropPreview,
  setNodes,
}: {
  panActive: boolean;
  drag: DragState | null;
  nodes: ArchitectureNode[];
  selectedNodeIds: string[];
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  terminalLayouts: TerminalDockStackLayout[];
  panFromPointer: (event: Pick<ReactPointerEvent<SVGSVGElement>, "clientX" | "clientY">) => void;
  updateShapeGesture: (event: ReactPointerEvent<SVGSVGElement>) => boolean;
  svgPointFromClient: (point: { clientX: number; clientY: number }) => Point;
  drawableBounds: () => Bounds;
  updateTerminalGroupBounds: (
    groups: ArchitectureTerminalDockGroup[],
    groupId: string,
    bounds: Bounds,
  ) => ArchitectureTerminalDockGroup[];
  resolveLiveSurfaceDockTarget: (point: { x: number; y: number }, surfaceId: string) => void;
  setTerminalDockGroups: Dispatch<SetStateAction<ArchitectureTerminalDockGroup[]>>;
  setTerminalDropPreview: Dispatch<SetStateAction<SurfacePreview | null>>;
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
}) {
  return (event: ReactPointerEvent<SVGSVGElement>) => {
    if (panActive) {
      panFromPointer(event);
      return;
    }
    if (updateShapeGesture(event)) return;
    if (!drag) return;

    const point = svgPointFromClient(event);
    const bounds = drawableBounds();
    const move = resolveCanvasDragMove({
      nodes,
      drag,
      point,
      bounds,
      selectedNodeIds,
      terminalLayouts,
    });
    if (!move) return;
    const { dragged, nextBounds } = move;

    if (drag.terminalGroupId) {
      if (!isLiveSurfaceKind(dragged.kind)) return;
      setTerminalDockGroups((current) =>
        updateTerminalGroupBounds(current, drag.terminalGroupId!, nextBounds),
      );
      const terminalGroup = terminalDockGroups.find(
        (group) => group.id === drag.terminalGroupId,
      );
      if (terminalGroup && !terminalDockGroupUsesSharedHeader(terminalGroup)) {
        setTerminalDropPreview({ id: dragged.id, ...nextBounds });
        resolveLiveSurfaceDockTarget(
          { x: event.clientX, y: event.clientY },
          dragged.id,
        );
      }
      return;
    }

    if (isLiveSurfaceKind(dragged.kind)) {
      setTerminalDropPreview({ id: dragged.id, ...nextBounds });
      resolveLiveSurfaceDockTarget(
        { x: event.clientX, y: event.clientY },
        dragged.id,
      );
      return;
    }

    setTerminalDockGroups((current) =>
      applyCanvasDragMove({
        nodes,
        terminalDockGroups: current,
        drag,
        point,
        bounds,
        selectedNodeIds,
        terminalLayouts,
      }).terminalDockGroups,
    );
    setNodes((current) =>
      applyCanvasDragMove({
        nodes: current,
        terminalDockGroups,
        drag,
        point,
        bounds,
        selectedNodeIds,
        terminalLayouts,
      }).nodes,
    );
  };
}

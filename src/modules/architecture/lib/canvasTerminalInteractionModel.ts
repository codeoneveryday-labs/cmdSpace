import type {
  ArchitectureDiagramNode,
  ArchitectureTerminalDockGroup,
} from "@/modules/tabs";
import {
  detachTerminal,
  dockTerminal,
  normalizeTerminalDockGroups,
  type TerminalDockDropTarget,
  type TerminalDockStackLayout,
} from "../terminalDockLayout";

export type CanvasTerminalDragState = {
  id: string;
  dx: number;
  dy: number;
  terminalGroupId?: string;
};

export type CanvasTerminalDropPreview = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TerminalDropResult =
  | { kind: "dock"; nextGroups: ArchitectureTerminalDockGroup[] }
  | { kind: "detach"; nextGroups: ArchitectureTerminalDockGroup[] }
  | { kind: "sync-frame"; frameId?: string; terminalIds: string[] }
  | { kind: "none" };

export function resolveNextTerminalTabState({
  activeTerminalId,
  closingTerminalId,
  maximizedTerminalId,
  terminalIds,
}: {
  activeTerminalId: string;
  closingTerminalId: string;
  maximizedTerminalId: string;
  terminalIds: string[];
}) {
  const nextTerminalId = terminalIds.find((id) => id !== closingTerminalId) ?? "";
  return {
    activeTerminalId:
      activeTerminalId === closingTerminalId ? nextTerminalId : activeTerminalId,
    maximizedTerminalId:
      maximizedTerminalId === closingTerminalId
        ? nextTerminalId
        : maximizedTerminalId,
  };
}

export function resolveTerminalDropResult({
  dockTarget,
  drag,
  draggedTerminal,
  frameId,
  terminalDockGroups,
  terminalDropPreview,
  terminalLayouts,
  terminalNodes,
}: {
  dockTarget: TerminalDockDropTarget | null;
  drag: CanvasTerminalDragState | null;
  draggedTerminal: Pick<ArchitectureDiagramNode, "id" | "kind"> | null;
  frameId?: string;
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  terminalDropPreview: CanvasTerminalDropPreview | null;
  terminalLayouts: TerminalDockStackLayout[];
  terminalNodes: ArchitectureDiagramNode[];
}): TerminalDropResult {
  if (drag && terminalDropPreview?.id === drag.id) {
    const isLiveSurface =
      draggedTerminal?.kind === "terminal" || draggedTerminal?.kind === "browser";
    if (isLiveSurface && dockTarget) {
      return {
        kind: "dock",
        nextGroups: normalizeTerminalDockGroups(
          terminalNodes,
          dockTerminal(terminalDockGroups, draggedTerminal.id, dockTarget),
        ),
      };
    }
    if (isLiveSurface && !drag.terminalGroupId) {
      return {
        kind: "detach",
        nextGroups: detachTerminal(
          terminalDockGroups,
          draggedTerminal.id,
          terminalDropPreview,
        ),
      };
    }
  }

  if (drag?.terminalGroupId && !dockTarget) {
    return {
      kind: "sync-frame",
      frameId,
      terminalIds: terminalLayouts
        .filter((layout) => layout.groupId === drag.terminalGroupId)
        .flatMap((layout) => layout.terminalIds),
    };
  }

  return { kind: "none" };
}

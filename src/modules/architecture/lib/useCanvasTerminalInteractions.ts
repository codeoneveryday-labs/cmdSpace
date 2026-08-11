import type {
  ArchitectureDiagramNode,
  ArchitectureTerminalDockGroup,
} from "@/modules/tabs";
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";

import {
  activateTerminalTab as updateActiveTerminalTab,
  detachTerminal,
  dockTerminal,
  normalizeTerminalDockGroups,
  type TerminalDockDropTarget,
  type TerminalDockRect,
  type TerminalDockStackLayout,
} from "../terminalDockLayout";

type SelectSingleNode = (id: string) => void;

type UseCanvasTerminalInteractionsArgs = {
  onActiveTerminalChange?: (
    tabId: number,
    terminalId: string | null,
  ) => void;
  selectSingleNode: SelectSingleNode;
  setMaximizedTerminalId: Dispatch<SetStateAction<string>>;
  setTerminalDockGroups: Dispatch<
    SetStateAction<ArchitectureTerminalDockGroup[]>
  >;
  tabId: number;
};

export type CanvasTerminalDragState = {
  id: string;
  dx: number;
  dy: number;
  sourceBounds?: TerminalDockRect;
  terminalGroupId?: string;
};

export type CanvasTerminalDropPreview = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type ResolveNextTerminalTabStateArgs = {
  activeTerminalId: string;
  closingTerminalId: string;
  maximizedTerminalId: string;
  terminalIds: string[];
};

type ResolveTerminalDropResultArgs = {
  dockTarget: TerminalDockDropTarget | null;
  drag: CanvasTerminalDragState | null;
  draggedTerminal: Pick<ArchitectureDiagramNode, "id" | "kind"> | null;
  frameId?: string;
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  terminalDropPreview: CanvasTerminalDropPreview | null;
  terminalLayouts: TerminalDockStackLayout[];
  terminalNodes: ArchitectureDiagramNode[];
};

export type TerminalDropResult =
  | {
      kind: "dock";
      nextGroups: ArchitectureTerminalDockGroup[];
    }
  | {
      kind: "detach";
      nextGroups: ArchitectureTerminalDockGroup[];
    }
  | {
      kind: "sync-frame";
      frameId?: string;
      terminalIds: string[];
    }
  | {
      kind: "none";
    };

export function resolveNextTerminalTabState({
  activeTerminalId,
  closingTerminalId,
  maximizedTerminalId,
  terminalIds,
}: ResolveNextTerminalTabStateArgs) {
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
}: ResolveTerminalDropResultArgs): TerminalDropResult {
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

export function useCanvasTerminalInteractions({
  onActiveTerminalChange,
  selectSingleNode,
  setMaximizedTerminalId,
  setTerminalDockGroups,
  tabId,
}: UseCanvasTerminalInteractionsArgs) {
  const [activeTerminalId, setActiveTerminalId] = useState("");

  useEffect(() => {
    onActiveTerminalChange?.(tabId, activeTerminalId || null);
  }, [activeTerminalId, onActiveTerminalChange, tabId]);

  useEffect(
    () => () => onActiveTerminalChange?.(tabId, null),
    [onActiveTerminalChange, tabId],
  );

  const activateTerminal = (terminalId: string) => {
    setActiveTerminalId(terminalId);
    selectSingleNode(terminalId);
  };

  const activateTerminalTab = ({
    layout,
    maximized,
    terminalId,
  }: {
    layout?: Pick<TerminalDockStackLayout, "stackId">;
    maximized: boolean;
    terminalId: string;
  }) => {
    activateTerminal(terminalId);
    if (maximized) {
      setMaximizedTerminalId(terminalId);
    }
    if (!layout) return;
    setTerminalDockGroups((current) =>
      updateActiveTerminalTab(current, layout.stackId, terminalId),
    );
  };

  const closeTerminalTab = ({
    layout,
    maximizedTerminalId,
    terminalId,
  }: {
    layout?: Pick<TerminalDockStackLayout, "terminalIds">;
    maximizedTerminalId: string;
    terminalId: string;
  }) => {
    const nextState = resolveNextTerminalTabState({
      activeTerminalId,
      closingTerminalId: terminalId,
      maximizedTerminalId,
      terminalIds: layout?.terminalIds ?? [],
    });
    if (nextState.activeTerminalId !== activeTerminalId) {
      setActiveTerminalId(nextState.activeTerminalId);
    }
    if (nextState.maximizedTerminalId !== maximizedTerminalId) {
      setMaximizedTerminalId(nextState.maximizedTerminalId);
    }
  };

  return {
    activateTerminal,
    activateTerminalTab,
    activeTerminalId,
    closeTerminalTab,
    setActiveTerminalId,
  };
}

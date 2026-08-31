import type { PointerEvent as ReactPointerEvent } from "react";
import type {
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
  CanvasMode,
} from "../lib/architectureCanvasTypes";
import type { TerminalDockStackLayout } from "../terminalDockLayout";
import { terminalDockGroupUsesSharedHeader } from "../terminalDockLayout";
import { shapeFor } from "../lib/architectureShapeCatalog";
import { CanvasBrowserSurface } from "./CanvasBrowserSurface";

type SurfaceTab = {
  id: string;
  label: string;
  kind: "terminal" | "browser";
};

export type CanvasBrowserLayerActions = {
  onUrlChange: (nodeId: string, url: string) => void;
  onActivate: (nodeId: string) => void;
  onActivateTab: (
    id: string,
    layout: TerminalDockStackLayout | undefined,
    maximized: boolean,
  ) => void;
  onTabPointerDown: (
    nodeId: string,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onRequestCloseTab: (
    id: string,
    layout: TerminalDockStackLayout | undefined,
  ) => void;
  onAddTab: (
    layout: TerminalDockStackLayout | undefined,
    node: ArchitectureNode,
  ) => void;
  onSplitRight: (
    layout: TerminalDockStackLayout | undefined,
    node: ArchitectureNode,
  ) => void;
  onHeaderPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    node: ArchitectureNode,
    layout: TerminalDockStackLayout | undefined,
    group: ArchitectureTerminalDockGroup | undefined,
    groupLocked: boolean,
    maximized: boolean,
  ) => void;
  onToggleGroupLock: (ids: string[], locked: boolean) => void;
  onToggleGroupMaximize: (nodeId: string) => void;
  onRequestCloseGroup: (
    group: ArchitectureTerminalDockGroup | undefined,
    nodeId: string,
  ) => void;
  onResizePointerDown: (
    event: ReactPointerEvent<SVGRectElement>,
    node: ArchitectureNode,
    handle: "nw" | "ne" | "se" | "sw",
  ) => void;
};

export function CanvasBrowserLayer({
  active,
  mode,
  panActive,
  dragActive,
  resizeActive,
  terminalResizePaused,
  appZoom,
  view,
  browserNodes,
  nodeById,
  terminalDockGroups,
  terminalLayouts,
  terminalLayoutById,
  renderedTerminalLayoutById,
  maximizedTerminalId,
  maximizedTerminalGroupId,
  selectedNodeIds,
  actions,
}: {
  active: boolean;
  mode: CanvasMode;
  panActive: boolean;
  dragActive: boolean;
  resizeActive: boolean;
  terminalResizePaused: boolean;
  appZoom: number;
  view: { x: number; y: number; scale: number };
  browserNodes: ArchitectureNode[];
  nodeById: Map<string, ArchitectureNode>;
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  terminalLayouts: TerminalDockStackLayout[];
  terminalLayoutById: Map<string, TerminalDockStackLayout>;
  renderedTerminalLayoutById: Map<string, TerminalDockStackLayout>;
  maximizedTerminalId: string;
  maximizedTerminalGroupId: string;
  selectedNodeIds: string[];
  actions: CanvasBrowserLayerActions;
}) {
  const interactionBlocked = Boolean(
    mode === "pan" || panActive || dragActive || resizeActive || terminalResizePaused,
  );

  return (
    <>
      {browserNodes.map((node) => {
        const layout = terminalLayoutById.get(node.id);
        const renderedLayout = renderedTerminalLayoutById.get(node.id);
        const surfaceGroup = layout
          ? terminalDockGroups.find((group) => group.id === layout.groupId)
          : undefined;
        const maximized = Boolean(maximizedTerminalGroupId && renderedLayout);
        const usesSharedHeader = surfaceGroup
          ? terminalDockGroupUsesSharedHeader(surfaceGroup)
          : false;
        const surfaceGroupIds = surfaceGroup
          ? terminalLayouts
              .filter((candidate) => candidate.groupId === surfaceGroup.id)
              .flatMap((candidate) => candidate.terminalIds)
          : [node.id];
        const surfaceGroupLocked = surfaceGroupIds.every((id) =>
          Boolean(nodeById.get(id)?.locked),
        );
        const bounds = renderedLayout?.rect ?? layout?.rect ?? node;
        const visible =
          active &&
          (!layout || layout.activeTerminalId === node.id) &&
          (!maximizedTerminalId || Boolean(renderedLayout));
        const boundsRevision = [
          view.x,
          view.y,
          view.scale,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
          appZoom,
          interactionBlocked ? 1 : 0,
        ].join(":");
        const stackTabs = (layout?.terminalIds ?? [node.id])
          .map((id) => {
            const tabNode = nodeById.get(id);
            return tabNode
              ? {
                  id,
                  label: tabNode.label || shapeFor(tabNode.kind).label,
                  kind: tabNode.kind as "terminal" | "browser",
                }
              : null;
          })
          .filter((tab): tab is SurfaceTab => tab !== null);

        return (
          <CanvasBrowserSurface
            key={node.id}
            node={node}
            layout={layout}
            bounds={bounds}
            visible={visible}
            selected={selectedNodeIds.includes(node.id)}
            maximized={maximized}
            usesSharedHeader={usesSharedHeader}
            surfaceGroupLocked={surfaceGroupLocked}
            interactionBlocked={interactionBlocked}
            boundsRevision={boundsRevision}
            stackTabs={stackTabs}
            onUrlChange={(url) => actions.onUrlChange(node.id, url)}
            onActivate={() => actions.onActivate(node.id)}
            onActivateTab={(id) => actions.onActivateTab(id, layout, maximized)}
            onTabPointerDown={actions.onTabPointerDown}
            onRequestCloseTab={(id) => actions.onRequestCloseTab(id, layout)}
            onAddTab={() => actions.onAddTab(layout, node)}
            onSplitRight={() => actions.onSplitRight(layout, node)}
            onHeaderPointerDown={(event) =>
              actions.onHeaderPointerDown(
                event,
                node,
                layout,
                surfaceGroup,
                surfaceGroupLocked,
                maximized,
              )
            }
            onToggleSurfaceGroupLock={() =>
              actions.onToggleGroupLock(surfaceGroupIds, surfaceGroupLocked)
            }
            onToggleSurfaceGroupMaximize={() =>
              actions.onToggleGroupMaximize(node.id)
            }
            onRequestCloseSurfaceGroup={() =>
              actions.onRequestCloseGroup(surfaceGroup, node.id)
            }
            onResizePointerDown={actions.onResizePointerDown}
          />
        );
      })}
    </>
  );
}

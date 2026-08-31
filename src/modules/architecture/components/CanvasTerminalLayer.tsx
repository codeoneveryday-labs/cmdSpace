import type {
  PointerEvent as ReactPointerEvent,
  RefObject,
  WheelEvent as ReactWheelEvent,
} from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import { detectCliAgent } from "@/modules/terminal/lib/cliAgents";
import type { CanvasTerminalHandle } from "../CanvasTerminalNode";
import type {
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
  CanvasMode,
  LiveSurfaceKind,
} from "../lib/architectureCanvasTypes";
import {
  terminalDockCornerClassName,
  terminalDockGroupUsesSharedHeader,
  type TerminalDockDividerLayout,
  type TerminalDockStackLayout,
} from "../terminalDockLayout";
import { CanvasDockDivider } from "./CanvasDockDivider";
import { CanvasTerminalGroupHeader } from "./CanvasTerminalGroupHeader";
import { CanvasTerminalSurface } from "./CanvasTerminalSurface";

type SurfaceTab = {
  id: string;
  label: string;
  kind: LiveSurfaceKind;
  agent: CliAgent | null;
};

export type CanvasTerminalLayerActions = {
  onGroupPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    group: ArchitectureTerminalDockGroup,
    activeTerminalNode: ArchitectureNode,
    locked: boolean,
  ) => void;
  onToggleGroupLock: (
    terminalIds: string[],
    locked: boolean,
  ) => void;
  onToggleGroupMaximize: (
    terminalId: string,
    maximized: boolean,
  ) => void;
  onCloseGroup: (group: ArchitectureTerminalDockGroup) => void;
  onHandleChange: (
    nodeId: string,
    handle: CanvasTerminalHandle | null,
  ) => void;
  onToggleSurfaceGroupLock: (terminalIds: string[], locked: boolean) => void;
  onToggleSurfaceGroupMaximize: (terminalId: string) => void;
  onRequestCloseSurfaceGroup: (
    group: ArchitectureTerminalDockGroup | undefined,
    nodeId: string,
  ) => void;
  onCanvasPanStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCanvasPanMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onCanvasPanEnd: () => void;
  onCanvasWheel: (event: ReactWheelEvent<HTMLDivElement>) => void;
  onActivateTerminal: (nodeId: string) => void;
  onActivateTab: (args: {
    layout: TerminalDockStackLayout | undefined;
    maximized: boolean;
    terminalId: string;
  }) => void;
  onTabPointerDown: (
    nodeId: string,
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onRequestCloseTab: (args: {
    layout: TerminalDockStackLayout | undefined;
    maximizedTerminalId: string;
    terminalId: string;
  }) => void;
  onAddTab: (
    layout: TerminalDockStackLayout | undefined,
    node: ArchitectureNode,
    initialCommand?: string,
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
  onCwdChange: (nodeId: string, cwd: string) => void;
  onInitialCommandChange: (nodeId: string, command: string) => void;
  onResizePointerDown: (
    event: ReactPointerEvent<SVGRectElement>,
    node: ArchitectureNode,
    handle: "nw" | "ne" | "se" | "sw",
  ) => void;
  onDockDividerPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
  ) => void;
  onDockDividerPointerMove: (
    event: ReactPointerEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
  ) => void;
  onDockDividerPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onDockDividerKeyDown: (
    event: React.KeyboardEvent<HTMLDivElement>,
    divider: TerminalDockDividerLayout,
  ) => void;
};

export function CanvasTerminalLayer({
  active,
  mode,
  terminalWorldRef,
  terminalTransform,
  terminalNodes,
  nodeById,
  terminalDockGroups,
  activeTerminalId,
  selectedNodeIds,
  terminalLayouts,
  renderedTerminalDockGroups,
  renderedTerminalLayouts,
  terminalLayoutById,
  renderedTerminalLayoutById,
  renderedTerminalDockDividers,
  maximizedTerminalId,
  maximizedTerminalGroupId,
  terminalResizePaused,
  actions,
}: {
  active: boolean;
  mode: CanvasMode;
  terminalWorldRef: RefObject<HTMLDivElement | null>;
  terminalTransform: {
    translateX: number;
    translateY: number;
    scale: number;
  };
  terminalNodes: ArchitectureNode[];
  nodeById: Map<string, ArchitectureNode>;
  terminalDockGroups: ArchitectureTerminalDockGroup[];
  activeTerminalId: string;
  selectedNodeIds: string[];
  terminalLayouts: TerminalDockStackLayout[];
  renderedTerminalDockGroups: ArchitectureTerminalDockGroup[];
  renderedTerminalLayouts: TerminalDockStackLayout[];
  terminalLayoutById: Map<string, TerminalDockStackLayout>;
  renderedTerminalLayoutById: Map<string, TerminalDockStackLayout>;
  renderedTerminalDockDividers: TerminalDockDividerLayout[];
  maximizedTerminalId: string;
  maximizedTerminalGroupId: string;
  terminalResizePaused: boolean;
  actions: CanvasTerminalLayerActions;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        ref={terminalWorldRef}
        data-canvas-terminal-world="true"
        className="absolute left-0 top-0 h-0 w-0"
        style={{
          transform: `translate3d(${terminalTransform.translateX}px, ${terminalTransform.translateY}px, 0) scale(${terminalTransform.scale})`,
          transformOrigin: "0 0",
          willChange: "transform",
        }}
      >
        {renderedTerminalDockGroups.map((group) => {
          const groupLayouts = renderedTerminalLayouts.filter(
            (layout) => layout.groupId === group.id,
          );
          const terminalIds = groupLayouts.flatMap(
            (layout) => layout.terminalIds,
          );
          const maximizedTerminal = terminalIds.find(
            (terminalId) => terminalId === maximizedTerminalId,
          );
          if (!active || (maximizedTerminalId && !maximizedTerminal)) {
            return null;
          }
          if (!terminalDockGroupUsesSharedHeader(group)) return null;

          const activeTerminal = terminalIds.includes(activeTerminalId)
            ? activeTerminalId
            : groupLayouts[0]?.activeTerminalId ?? terminalIds[0];
          const activeTerminalNode = activeTerminal
            ? nodeById.get(activeTerminal)
            : undefined;
          if (!activeTerminal || !activeTerminalNode) return null;
          const locked = terminalIds.every((terminalId) =>
            Boolean(nodeById.get(terminalId)?.locked),
          );

          return (
            <CanvasTerminalGroupHeader
              key={group.id}
              group={group}
              activeTerminalNode={activeTerminalNode}
              locked={locked}
              maximizedTerminal={maximizedTerminal}
              onPointerDown={actions.onGroupPointerDown}
              onToggleLock={() => actions.onToggleGroupLock(terminalIds, locked)}
              onToggleMaximize={() =>
                actions.onToggleGroupMaximize(
                  activeTerminal,
                  Boolean(maximizedTerminal),
                )
              }
              onClose={() => actions.onCloseGroup(group)}
            />
          );
        })}

        {terminalNodes.map((node) => {
          const layout = terminalLayoutById.get(node.id);
          const renderedLayout = renderedTerminalLayoutById.get(node.id);
          const terminalGroup = layout
            ? terminalDockGroups.find((group) => group.id === layout.groupId)
            : undefined;
          const maximized = Boolean(maximizedTerminalGroupId && renderedLayout);
          const usesSharedHeader = terminalGroup
            ? terminalDockGroupUsesSharedHeader(terminalGroup)
            : false;
          const terminalGroupIds = terminalGroup
            ? terminalLayouts
                .filter((candidate) => candidate.groupId === terminalGroup.id)
                .flatMap((candidate) => candidate.terminalIds)
            : [node.id];
          const terminalGroupLocked = terminalGroupIds.every((terminalId) =>
            Boolean(nodeById.get(terminalId)?.locked),
          );
          const bounds = renderedLayout?.rect ?? layout?.rect ?? node;
          const visible =
            active &&
            (!layout || layout.activeTerminalId === node.id) &&
            (!maximizedTerminalId || Boolean(renderedLayout));
          const renderedTerminalGroup = renderedLayout
            ? renderedTerminalDockGroups.find(
                (group) => group.id === renderedLayout.groupId,
              )
            : undefined;
          const selectionBounds = renderedTerminalGroup ?? bounds;
          const stackTabs = (layout?.terminalIds ?? [node.id])
            .map((terminalId) => {
              const terminalNode = nodeById.get(terminalId);
              if (!terminalNode) return null;
              const cwd = terminalNode.cwd?.replace(/\/$/, "");
              return {
                id: terminalId,
                kind: terminalNode.kind as LiveSurfaceKind,
                agent:
                  terminalNode.kind === "terminal"
                    ? detectCliAgent(terminalNode.initialCommand)
                    : null,
                label: cwd?.split("/").pop() || terminalNode.label || "Terminal",
              };
            })
            .filter((tab): tab is SurfaceTab => tab !== null);

          return (
            <CanvasTerminalSurface
              key={node.id}
              node={node}
              layout={layout}
              bounds={bounds}
              selectionBounds={selectionBounds}
              stackTabs={stackTabs}
              visible={visible}
              selected={selectedNodeIds.includes(node.id)}
              maximized={maximized}
              usesSharedHeader={usesSharedHeader}
              terminalGroupLocked={terminalGroupLocked}
              terminalResizePaused={terminalResizePaused}
              panning={mode === "pan"}
              cornerClassName={terminalDockCornerClassName(
                bounds,
                renderedTerminalGroup ?? terminalGroup ?? bounds,
              )}
              onHandleChange={actions.onHandleChange}
              onToggleGroupLock={() =>
                actions.onToggleSurfaceGroupLock(
                  terminalGroupIds,
                  terminalGroupLocked,
                )
              }
              onToggleGroupMaximize={() =>
                actions.onToggleSurfaceGroupMaximize(node.id)
              }
              onRequestCloseGroup={() =>
                actions.onRequestCloseSurfaceGroup(terminalGroup, node.id)
              }
              onCanvasPanStart={actions.onCanvasPanStart}
              onCanvasPanMove={actions.onCanvasPanMove}
              onCanvasPanEnd={actions.onCanvasPanEnd}
              onCanvasWheel={actions.onCanvasWheel}
              onActivate={() => actions.onActivateTerminal(node.id)}
              onActivateTab={(terminalId) =>
                actions.onActivateTab({
                  layout,
                  maximized,
                  terminalId,
                })
              }
              onTabPointerDown={actions.onTabPointerDown}
              onRequestCloseTab={(terminalId) =>
                actions.onRequestCloseTab({
                  layout,
                  maximizedTerminalId,
                  terminalId,
                })
              }
              onAddTab={(initialCommand) =>
                actions.onAddTab(layout, node, initialCommand)
              }
              onSplitRight={() => actions.onSplitRight(layout, node)}
              onHeaderPointerDown={(event) =>
                actions.onHeaderPointerDown(
                  event,
                  node,
                  layout,
                  terminalGroup,
                  terminalGroupLocked,
                  maximized,
                )
              }
              onCwdChange={(cwd) => actions.onCwdChange(node.id, cwd)}
              onInitialCommandChange={(command) =>
                actions.onInitialCommandChange(node.id, command)
              }
              onResizePointerDown={actions.onResizePointerDown}
            />
          );
        })}

        {renderedTerminalDockDividers.map((divider) => (
          <CanvasDockDivider
            key={`${divider.groupId}-${divider.splitId}`}
            divider={divider}
            onPointerDown={actions.onDockDividerPointerDown}
            onPointerMove={actions.onDockDividerPointerMove}
            onPointerUp={actions.onDockDividerPointerUp}
            onKeyDown={actions.onDockDividerKeyDown}
          />
        ))}
      </div>
    </div>
  );
}

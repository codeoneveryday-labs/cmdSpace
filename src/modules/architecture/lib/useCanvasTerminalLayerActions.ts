import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
  WheelEvent as ReactWheelEvent,
} from "react";
import type { CanvasTerminalHandle } from "../CanvasTerminalNode";
import type { CanvasTerminalLayerActions } from "../components/CanvasTerminalLayer";
import type {
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
} from "./architectureCanvasTypes";
import { registerTerminalHandle } from "./canvasTerminalFocusModel";
import type { TerminalDockStackLayout } from "../terminalDockLayout";

export function useCanvasTerminalLayerActions({
  tabId,
  nodeById,
  terminalInteractions,
  terminalHandleRef,
  onTerminalHandleChange,
  handleTerminalGroupHeaderPointerDown,
  handleNodePointerDown,
  handlePointerMove,
  handlePointerEnd,
  camera,
  closeTerminalGroup,
  eraseNode,
  createDockedSurface,
  pushHistory,
  setNodes,
  setMaximizedTerminalId,
  terminalDockGroupUsesSharedHeader,
  handleResizePointerDown,
  handleDockDividerPointerDown,
  handleDockDividerPointerMove,
  finishDockDividerResize,
  handleDockDividerKeyDown,
}: {
  tabId: number;
  nodeById: Map<string, ArchitectureNode>;
  terminalInteractions: {
    activateTerminal: (id: string) => void;
    activateTerminalTab: (args: {
      layout?: Pick<TerminalDockStackLayout, "stackId">;
      maximized: boolean;
      terminalId: string;
    }) => void;
    closeTerminalTab: (args: {
      layout?: Pick<TerminalDockStackLayout, "terminalIds">;
      maximizedTerminalId: string;
      terminalId: string;
    }) => void;
  };
  terminalHandleRef: Map<string, CanvasTerminalHandle>;
  onTerminalHandleChange?: (
    tabId: number,
    terminalId: string,
    handle: CanvasTerminalHandle | null,
  ) => void;
  handleTerminalGroupHeaderPointerDown: CanvasTerminalLayerActions["onGroupPointerDown"];
  handleNodePointerDown: (
    event: ReactPointerEvent<SVGGElement>,
    node: ArchitectureNode,
  ) => void;
  handlePointerMove: (event: ReactPointerEvent<SVGSVGElement>) => void;
  handlePointerEnd: () => void;
  camera: {
    startPan: (event: ReactPointerEvent<SVGSVGElement>) => void;
    handleWheel: (event: ReactWheelEvent<SVGSVGElement>) => void;
  };
  closeTerminalGroup: (group: ArchitectureTerminalDockGroup) => void;
  eraseNode: (id: string) => void;
  createDockedSurface: (
    layout: TerminalDockStackLayout,
    kind: "tab" | "split",
    node: ArchitectureNode,
    initialCommand?: string,
  ) => void;
  pushHistory: () => void;
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  setMaximizedTerminalId: Dispatch<SetStateAction<string>>;
  terminalDockGroupUsesSharedHeader: (
    group: ArchitectureTerminalDockGroup,
  ) => boolean;
  handleResizePointerDown: CanvasTerminalLayerActions["onResizePointerDown"];
  handleDockDividerPointerDown: CanvasTerminalLayerActions["onDockDividerPointerDown"];
  handleDockDividerPointerMove: CanvasTerminalLayerActions["onDockDividerPointerMove"];
  finishDockDividerResize: CanvasTerminalLayerActions["onDockDividerPointerUp"];
  handleDockDividerKeyDown: CanvasTerminalLayerActions["onDockDividerKeyDown"];
}): CanvasTerminalLayerActions {
  return {
    onGroupPointerDown: handleTerminalGroupHeaderPointerDown,
    onToggleGroupLock: (terminalIds, locked) => {
      pushHistory();
      setNodes((current) =>
        current.map((item) =>
          terminalIds.includes(item.id) ? { ...item, locked: !locked } : item,
        ),
      );
    },
    onToggleGroupMaximize: (terminalId, maximized) =>
      setMaximizedTerminalId(maximized ? "" : terminalId),
    onCloseGroup: closeTerminalGroup,
    onHandleChange: (terminalId, handle) => {
      registerTerminalHandle(terminalHandleRef, terminalId, handle);
      onTerminalHandleChange?.(tabId, terminalId, handle);
    },
    onToggleSurfaceGroupLock: (terminalIds, locked) => {
      pushHistory();
      setNodes((current) =>
        current.map((item) =>
          terminalIds.includes(item.id) ? { ...item, locked: !locked } : item,
        ),
      );
    },
    onToggleSurfaceGroupMaximize: (terminalId) =>
      setMaximizedTerminalId((current) =>
        current === terminalId ? "" : terminalId,
      ),
    onRequestCloseSurfaceGroup: (group, nodeId) => {
      if (group) {
        closeTerminalGroup(group);
        return;
      }
      eraseNode(nodeId);
    },
    onCanvasPanStart: (event) => camera.startPan(event as unknown as ReactPointerEvent<SVGSVGElement>),
    onCanvasPanMove: (event) =>
      handlePointerMove(event as unknown as ReactPointerEvent<SVGSVGElement>),
    onCanvasPanEnd: handlePointerEnd,
    onCanvasWheel: (event) =>
      camera.handleWheel(event as unknown as ReactWheelEvent<SVGSVGElement>),
    onActivateTerminal: terminalInteractions.activateTerminal,
    onActivateTab: terminalInteractions.activateTerminalTab,
    onTabPointerDown: (surfaceId, event) => {
      const surfaceNode = nodeById.get(surfaceId);
      if (!surfaceNode) return;
      handleNodePointerDown(
        event as unknown as ReactPointerEvent<SVGGElement>,
        surfaceNode,
      );
    },
    onRequestCloseTab: (args) => {
      terminalInteractions.closeTerminalTab(args);
      eraseNode(args.terminalId);
    },
    onAddTab: (layout, node, initialCommand) => {
      if (layout) createDockedSurface(layout, "tab", node, initialCommand);
    },
    onSplitRight: (layout, node) => {
      if (layout) createDockedSurface(layout, "split", node);
    },
    onHeaderPointerDown: (
      event,
      node,
      _layout,
      group,
      groupLocked,
      maximized,
    ) => {
      if (maximized) {
        event.preventDefault();
        event.stopPropagation();
        setMaximizedTerminalId("");
        return;
      }
      if (group && !terminalDockGroupUsesSharedHeader(group)) {
        handleTerminalGroupHeaderPointerDown(event, group, node, groupLocked);
        return;
      }
      handleNodePointerDown(
        event as unknown as ReactPointerEvent<SVGGElement>,
        node,
      );
    },
    onCwdChange: (nodeId, cwd) =>
      setNodes((current) =>
        current.map((item) => (item.id === nodeId ? { ...item, cwd } : item)),
      ),
    onInitialCommandChange: (nodeId, command) => {
      pushHistory();
      setNodes((current) =>
        current.map((item) =>
          item.id === nodeId ? { ...item, initialCommand: command } : item,
        ),
      );
    },
    onResizePointerDown: handleResizePointerDown,
    onDockDividerPointerDown: handleDockDividerPointerDown,
    onDockDividerPointerMove: handleDockDividerPointerMove,
    onDockDividerPointerUp: finishDockDividerResize,
    onDockDividerKeyDown: handleDockDividerKeyDown,
  };
}

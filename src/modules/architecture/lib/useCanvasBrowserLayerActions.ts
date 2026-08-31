import type {
  Dispatch,
  PointerEvent as ReactPointerEvent,
  SetStateAction,
} from "react";
import type { CanvasBrowserLayerActions } from "../components/CanvasBrowserLayer";
import type {
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
} from "./architectureCanvasTypes";
import type { TerminalDockStackLayout } from "../terminalDockLayout";

export function useCanvasBrowserLayerActions({
  nodeById,
  terminalInteractions,
  selectSingleNode,
  setActiveTerminalId,
  setMaximizedTerminalId,
  setNodes,
  pushHistory,
  handleNodePointerDown,
  handleTerminalGroupHeaderPointerDown,
  terminalDockGroupUsesSharedHeader,
  closeTerminalGroup,
  eraseNode,
  createDockedSurface,
  handleResizePointerDown,
}: {
  nodeById: Map<string, ArchitectureNode>;
  terminalInteractions: {
    activateTerminalTab: (args: {
      layout?: Pick<TerminalDockStackLayout, "stackId">;
      maximized: boolean;
      terminalId: string;
    }) => void;
  };
  selectSingleNode: (id: string) => void;
  setActiveTerminalId: Dispatch<SetStateAction<string>>;
  setMaximizedTerminalId: Dispatch<SetStateAction<string>>;
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  pushHistory: () => void;
  handleNodePointerDown: (
    event: ReactPointerEvent<SVGGElement>,
    node: ArchitectureNode,
  ) => void;
  handleTerminalGroupHeaderPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    group: ArchitectureTerminalDockGroup,
    node: ArchitectureNode,
    locked: boolean,
  ) => void;
  terminalDockGroupUsesSharedHeader: (
    group: ArchitectureTerminalDockGroup,
  ) => boolean;
  closeTerminalGroup: (group: ArchitectureTerminalDockGroup) => void;
  eraseNode: (id: string) => void;
  createDockedSurface: (
    layout: TerminalDockStackLayout,
    kind: "tab" | "split",
    node: ArchitectureNode,
  ) => void;
  handleResizePointerDown: CanvasBrowserLayerActions["onResizePointerDown"];
}): CanvasBrowserLayerActions {
  return {
    onUrlChange: (nodeId, url) => {
      pushHistory();
      let label = "Browser";
      try {
        label = new URL(url).host || label;
      } catch {
        label = url || label;
      }
      setNodes((current) =>
        current.map((item) =>
          item.id === nodeId ? { ...item, url, label } : item,
        ),
      );
    },
    onActivate: (nodeId) => {
      selectSingleNode(nodeId);
      const node = nodeById.get(nodeId);
      if (node?.kind === "terminal") setActiveTerminalId(nodeId);
    },
    onActivateTab: (id, layout, maximized) => {
      terminalInteractions.activateTerminalTab({ layout, maximized, terminalId: id });
    },
    onTabPointerDown: (surfaceId, event) => {
      const surfaceNode = nodeById.get(surfaceId);
      if (!surfaceNode) return;
      handleNodePointerDown(
        event as unknown as ReactPointerEvent<SVGGElement>,
        surfaceNode,
      );
    },
    onRequestCloseTab: (id, layout) => {
      const nextActiveId = layout?.terminalIds.find((candidate) => candidate !== id);
      setMaximizedTerminalId((current) =>
        current === id ? nextActiveId ?? "" : current,
      );
      eraseNode(id);
    },
    onAddTab: (layout, node) => {
      if (layout) createDockedSurface(layout, "tab", node);
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
    onToggleGroupLock: (ids, locked) => {
      pushHistory();
      setNodes((current) =>
        current.map((item) =>
          ids.includes(item.id) ? { ...item, locked: !locked } : item,
        ),
      );
    },
    onToggleGroupMaximize: (nodeId) =>
      setMaximizedTerminalId((current) =>
        current === nodeId ? "" : nodeId,
      ),
    onRequestCloseGroup: (group, nodeId) => {
      if (group) {
        closeTerminalGroup(group);
        return;
      }
      eraseNode(nodeId);
    },
    onResizePointerDown: handleResizePointerDown,
  };
}

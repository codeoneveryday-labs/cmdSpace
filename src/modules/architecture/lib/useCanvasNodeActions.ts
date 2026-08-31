import type { Dispatch, SetStateAction } from "react";
import type {
  ArchitectureEdge,
  ArchitectureNode,
  ArchitectureTerminalDockGroup,
  CanvasMode,
} from "./architectureCanvasTypes";
import { edge } from "./architectureDiagramSeed";
import { removeTerminalFromDock } from "../terminalDockLayout";

type NodeSetter = Dispatch<SetStateAction<ArchitectureNode[]>>;
type EdgeSetter = Dispatch<SetStateAction<ArchitectureEdge[]>>;
type DockGroupSetter = Dispatch<
  SetStateAction<ArchitectureTerminalDockGroup[]>
>;

export function useCanvasNodeActions({
  nodes,
  edges,
  selectedNode,
  selectedEdge,
  selectedNodeIds,
  connectSourceId,
  nextEdgeRef,
  setNodes,
  setEdges,
  setTerminalDockGroups,
  setConnectSourceId,
  setMode,
  pushHistory,
  clearSelection,
  clearEdgeSelection,
  selectSingleNode,
  selectEdge,
}: {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  selectedNode: ArchitectureNode | null;
  selectedEdge: ArchitectureEdge | null;
  selectedNodeIds: string[];
  connectSourceId: string | null;
  nextEdgeRef: { current: number };
  setNodes: NodeSetter;
  setEdges: EdgeSetter;
  setTerminalDockGroups: DockGroupSetter;
  setConnectSourceId: Dispatch<SetStateAction<string | null>>;
  setMode: Dispatch<SetStateAction<CanvasMode>>;
  pushHistory: () => void;
  clearSelection: () => void;
  clearEdgeSelection: () => void;
  selectSingleNode: (id: string) => void;
  selectEdge: (id: string) => void;
}) {
  const eraseNode = (id: string) => {
    const target = nodes.find((item) => item.id === id);
    if (!target || target.locked) return;
    pushHistory();
    setNodes((current) => current.filter((item) => item.id !== id));
    setTerminalDockGroups((current) => removeTerminalFromDock(current, id));
    setEdges((current) =>
      current.filter((item) => item.from !== id && item.to !== id),
    );
    clearSelection();
    setConnectSourceId(null);
  };

  const eraseEdge = (id: string) => {
    const target = edges.find((item) => item.id === id);
    if (!target || target.locked) return;
    pushHistory();
    setEdges((current) => current.filter((item) => item.id !== id));
    clearEdgeSelection();
  };

  const removeSelectedNode = () => {
    const targets = selectedNodeIds.length
      ? nodes.filter((item) => selectedNodeIds.includes(item.id) && !item.locked)
      : selectedNode && !selectedNode.locked
        ? [selectedNode]
        : [];
    if (targets.length === 0) return;
    const ids = new Set(targets.map((item) => item.id));
    pushHistory();
    setNodes((current) => current.filter((item) => !ids.has(item.id)));
    setTerminalDockGroups((current) =>
      [...ids].reduce(
        (groups, id) => removeTerminalFromDock(groups, id),
        current,
      ),
    );
    setEdges((current) =>
      current.filter((item) => !ids.has(item.from) && !ids.has(item.to)),
    );
    clearSelection();
    setConnectSourceId(null);
  };

  const removeSelectedEdge = () => {
    if (!selectedEdge || selectedEdge.locked) return;
    eraseEdge(selectedEdge.id);
  };

  const toggleSelectedLock = () => {
    if (!selectedNode && !selectedEdge) return;
    pushHistory();
    setMode("select");
    if (selectedNode) {
      setNodes((current) =>
        current.map((item) =>
          item.id === selectedNode.id ? { ...item, locked: !item.locked } : item,
        ),
      );
      return;
    }
    setEdges((current) =>
      current.map((item) =>
        item.id === selectedEdge?.id ? { ...item, locked: !item.locked } : item,
      ),
    );
  };

  const connectNodes = (targetId: string) => {
    if (!connectSourceId) {
      setConnectSourceId(targetId);
      selectSingleNode(targetId);
      return;
    }
    if (connectSourceId === targetId) return;
    const existing = edges.find(
      (item) => item.from === connectSourceId && item.to === targetId,
    );
    if (existing) {
      selectEdge(existing.id);
    } else {
      pushHistory();
      const id = `e${nextEdgeRef.current++}`;
      setEdges((current) => [
        ...current,
        edge(id, connectSourceId, targetId, "calls"),
      ]);
      selectEdge(id);
    }
    setConnectSourceId(null);
    setMode("select");
  };

  return {
    connectNodes,
    eraseEdge,
    eraseNode,
    removeSelectedEdge,
    removeSelectedNode,
    toggleSelectedLock,
  };
}

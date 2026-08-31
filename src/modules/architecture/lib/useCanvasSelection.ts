import { useState } from "react";

export function useCanvasSelection() {
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [selectedEdgeId, setSelectedEdgeId] = useState("");

  const selectSingleNode = (id: string) => {
    setSelectedNodeId(id);
    setSelectedNodeIds(id ? [id] : []);
    setSelectedEdgeId("");
  };

  const toggleNodeSelection = (id: string) => {
    setSelectedEdgeId("");
    setSelectedNodeIds((current) => {
      const next = current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id];
      setSelectedNodeId(next[next.length - 1] ?? "");
      return next;
    });
  };

  const selectEdge = (id: string) => {
    setSelectedEdgeId(id);
    setSelectedNodeId("");
    setSelectedNodeIds([]);
  };

  const clearEdgeSelection = () => setSelectedEdgeId("");

  const clearSelection = () => {
    setSelectedNodeId("");
    setSelectedNodeIds([]);
    setSelectedEdgeId("");
  };

  return {
    selectedNodeIds,
    selectedNodeId,
    selectedEdgeId,
    selectSingleNode,
    toggleNodeSelection,
    selectEdge,
    clearEdgeSelection,
    clearSelection,
  };
}

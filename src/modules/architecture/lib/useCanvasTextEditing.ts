import type {
  Dispatch,
  MouseEvent as ReactMouseEvent,
  SetStateAction,
} from "react";
import { useState } from "react";
import type { ArchitectureNode, Point } from "./architectureCanvasTypes";
import { fitTextNode, isEditableShortcutTarget } from "./architectureCanvasModel";

export function useCanvasTextEditing({
  setNodes,
  createTextNode,
  svgPointFromClient,
  pushHistory,
  selectSingleNode,
  setConnectSourceId,
  setMode,
}: {
  setNodes: Dispatch<SetStateAction<ArchitectureNode[]>>;
  createTextNode: (point: Point) => ArchitectureNode;
  svgPointFromClient: (point: { clientX: number; clientY: number }) => Point;
  pushHistory: () => void;
  selectSingleNode: (id: string) => void;
  setConnectSourceId: (id: string | null) => void;
  setMode: (mode: "select") => void;
}) {
  const [editingTextId, setEditingTextId] =
    useState<string>("");

  const updateTextNodeLabel = (id: string, label: string) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === id ? fitTextNode({ ...node, label }) : node,
      ),
    );
  };

  const handleNodeDoubleClick = (
    event: ReactMouseEvent<SVGGElement>,
    item: ArchitectureNode,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (item.kind !== "text" || item.locked) return;
    pushHistory();
    selectSingleNode(item.id);
    setConnectSourceId(null);
    setMode("select");
    setEditingTextId(item.id);
  };

  const handleCanvasDoubleClick = (
    event: ReactMouseEvent<SVGSVGElement>,
  ) => {
    if (isEditableShortcutTarget(event.target)) return;
    event.preventDefault();
    const point = svgPointFromClient(event);
    pushHistory();
    const created = { ...createTextNode(point), label: "" };
    setNodes((current) => [...current, created]);
    selectSingleNode(created.id);
    setConnectSourceId(null);
    setMode("select");
    setEditingTextId(created.id);
  };

  return {
    editingTextId,
    handleCanvasDoubleClick,
    handleNodeDoubleClick,
    setEditingTextId,
    updateTextNodeLabel,
  };
}

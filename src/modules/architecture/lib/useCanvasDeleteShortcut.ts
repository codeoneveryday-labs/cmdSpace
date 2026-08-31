import { useEffect } from "react";
import type { ArchitectureEdge, ArchitectureNode } from "./architectureCanvasTypes";
import { isEditableShortcutTarget } from "./architectureCanvasModel";

export function useCanvasDeleteShortcut({
  active,
  selectedNodeIds,
  selectedNode,
  selectedEdge,
  removeSelectedNode,
  removeSelectedEdge,
}: {
  active: boolean;
  selectedNodeIds: string[];
  selectedNode: ArchitectureNode | null;
  selectedEdge: ArchitectureEdge | null;
  removeSelectedNode: () => void;
  removeSelectedEdge: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const handleDeleteKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableShortcutTarget(event.target)
      ) {
        return;
      }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (selectedNodeIds.length === 0 && !selectedNode && !selectedEdge) return;

      event.preventDefault();
      if (selectedNode) {
        removeSelectedNode();
        return;
      }
      removeSelectedEdge();
    };

    window.addEventListener("keydown", handleDeleteKey);
    return () => window.removeEventListener("keydown", handleDeleteKey);
  }, [
    active,
    removeSelectedEdge,
    removeSelectedNode,
    selectedEdge,
    selectedNode,
    selectedNodeIds,
  ]);
}

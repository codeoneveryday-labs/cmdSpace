import { useEffect } from "react";
import { isEditableShortcutTarget } from "./architectureCanvasModel";

export function useCanvasUndoShortcut({
  active,
  canUndo,
  undoCanvas,
}: {
  active: boolean;
  canUndo: boolean;
  undoCanvas: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const handleCanvasUndo = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "z" ||
        isEditableShortcutTarget(event.target)
      ) {
        return;
      }
      if (!canUndo) return;
      event.preventDefault();
      undoCanvas();
    };

    window.addEventListener("keydown", handleCanvasUndo);
    return () => window.removeEventListener("keydown", handleCanvasUndo);
  }, [active, canUndo, undoCanvas]);
}

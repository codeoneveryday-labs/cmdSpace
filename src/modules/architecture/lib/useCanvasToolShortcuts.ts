import { useEffect } from "react";
import type { CanvasMode, LiveSurfaceKind } from "./architectureCanvasTypes";
import { isEditableShortcutTarget } from "./architectureCanvasModel";
import type { TerminalPlacement } from "../terminalPlacement";

const TOOL_SHORTCUTS = new Map<string, CanvasMode>([
  ["v", "select"],
  ["h", "pan"],
  ["c", "connect"],
  ["l", "line"],
  ["a", "arrow"],
  ["p", "pen"],
  ["t", "text"],
  ["i", "terminal"],
  ["f", "frame"],
  ["e", "eraser"],
]);

export function useCanvasToolShortcuts({
  active,
  pendingSurfaceKind,
  selectedNodeId,
  terminalPlacements,
  onBeginSurfacePlacement,
  onClearEdgeSelection,
  onCommitSurfacePlacement,
  onSetConnectSourceId,
  onToggleFreePlacement,
  onSetMode,
  onResetPlacement,
}: {
  active: boolean;
  pendingSurfaceKind: LiveSurfaceKind | null;
  selectedNodeId: string;
  terminalPlacements: TerminalPlacement[];
  onBeginSurfacePlacement: (kind: LiveSurfaceKind) => void;
  onClearEdgeSelection: () => void;
  onCommitSurfacePlacement: (
    kind: LiveSurfaceKind,
    placement: TerminalPlacement,
  ) => void;
  onSetConnectSourceId: (id: string | null) => void;
  onToggleFreePlacement: () => void;
  onSetMode: (mode: CanvasMode) => void;
  onResetPlacement: () => void;
}) {
  useEffect(() => {
    if (!active) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        isEditableShortcutTarget(event.target)
      ) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (terminalPlacements.length > 0) {
          onResetPlacement();
          return;
        }
        onSetMode("select");
        onSetConnectSourceId(null);
        return;
      }

      if (terminalPlacements.length > 0) {
        if (event.key === "Enter") {
          event.preventDefault();
          if (pendingSurfaceKind) {
            onCommitSurfacePlacement(pendingSurfaceKind, terminalPlacements[0]);
          }
          return;
        }
        if (event.key.toLowerCase() === "f") {
          event.preventDefault();
          onToggleFreePlacement();
          return;
        }
        const index = Number(event.key) - 1;
        if (Number.isInteger(index) && index >= 0 && index < terminalPlacements.length) {
          event.preventDefault();
          if (pendingSurfaceKind) {
            onCommitSurfacePlacement(pendingSurfaceKind, terminalPlacements[index]);
          }
        }
        return;
      }

      if (event.shiftKey) return;
      const nextMode = TOOL_SHORTCUTS.get(event.key.toLowerCase());
      if (!nextMode) return;

      event.preventDefault();
      if (nextMode === "terminal") {
        onBeginSurfacePlacement("terminal");
        return;
      }
      onSetMode(nextMode);
      onSetConnectSourceId(nextMode === "connect" ? selectedNodeId || null : null);
      if (nextMode === "connect") onClearEdgeSelection();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    active,
    onBeginSurfacePlacement,
    onClearEdgeSelection,
    onCommitSurfacePlacement,
    onSetConnectSourceId,
    onToggleFreePlacement,
    onSetMode,
    onResetPlacement,
    pendingSurfaceKind,
    selectedNodeId,
    terminalPlacements,
  ]);
}

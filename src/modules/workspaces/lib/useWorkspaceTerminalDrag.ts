import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { WorkspaceTerminalItem } from "../WorkspacesPanel";

type TerminalDragState = {
  sourceId: number;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  dragging: boolean;
  targetId: number | null;
};

export function useWorkspaceTerminalDrag({
  activeWorkspaceTerminals,
  onSwapTerminals,
}: {
  activeWorkspaceTerminals: WorkspaceTerminalItem[];
  onSwapTerminals: (sourceId: number, targetId: number) => void;
}) {
  const terminalDragRef = useRef<TerminalDragState | null>(null);
  const [terminalDragVisual, setTerminalDragVisual] = useState<{
    sourceId: number;
    targetId: number | null;
    x: number;
    y: number;
  } | null>(null);

  const startTerminalDrag = useCallback(
    (terminal: WorkspaceTerminalItem, event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || activeWorkspaceTerminals.length < 2) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      terminalDragRef.current = {
        sourceId: terminal.leafId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - bounds.left,
        offsetY: event.clientY - bounds.top,
        width: bounds.width,
        height: bounds.height,
        dragging: false,
        targetId: null,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [activeWorkspaceTerminals.length],
  );

  useEffect(() => {
    const clearTerminalDrag = () => {
      terminalDragRef.current = null;
      setTerminalDragVisual(null);
    };

    const targetAtPoint = (clientX: number, clientY: number) => {
      const drag = terminalDragRef.current;
      if (!drag) return null;
      const row = document
        .elementsFromPoint(clientX, clientY)
        .map((element) => element.closest<HTMLElement>("[data-terminal-leaf-id]"))
        .find((element): element is HTMLElement => element !== null);
      const candidate = row ? Number(row.dataset.terminalLeafId) : null;
      return candidate !== null &&
        candidate !== drag.sourceId &&
        activeWorkspaceTerminals.some((terminal) => terminal.leafId === candidate)
        ? candidate
        : null;
    };

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const drag = terminalDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const moved =
        Math.abs(event.clientX - drag.startX) > 4 ||
        Math.abs(event.clientY - drag.startY) > 4;
      if (!drag.dragging && !moved) return;
      event.preventDefault();
      const targetId = targetAtPoint(event.clientX, event.clientY);
      terminalDragRef.current = { ...drag, dragging: true, targetId };
      setTerminalDragVisual({
        sourceId: drag.sourceId,
        targetId,
        x: event.clientX,
        y: event.clientY,
      });
    };

    const handlePointerUp = (event: globalThis.PointerEvent) => {
      const drag = terminalDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const targetId = targetAtPoint(event.clientX, event.clientY);
      if (drag.dragging && targetId !== null) {
        onSwapTerminals(drag.sourceId, targetId);
      }
      clearTerminalDrag();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !terminalDragRef.current) return;
      event.preventDefault();
      clearTerminalDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", clearTerminalDrag);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", clearTerminalDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", clearTerminalDrag);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", clearTerminalDrag);
    };
  }, [activeWorkspaceTerminals, onSwapTerminals]);

  return { terminalDragRef, terminalDragVisual, startTerminalDrag };
}

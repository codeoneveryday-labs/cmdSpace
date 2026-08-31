import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { WorkspaceItem } from "../WorkspacesPanel";

type WorkspaceDragState = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  dragging: boolean;
  previewIndex: number;
};

export function useWorkspaceReorderDrag({
  workspaces,
  containerRef,
  onReorderWorkspaces,
}: {
  workspaces: WorkspaceItem[];
  containerRef: MutableRefObject<HTMLDivElement | null>;
  onReorderWorkspaces?: (
    draggedId: string,
    targetId: string,
    position: "before" | "after",
  ) => void;
}) {
  const pointerDragRef = useRef<WorkspaceDragState | null>(null);
  const [dragVisual, setDragVisual] = useState<{
    id: string;
    height: number;
    x: number;
    y: number;
    previewIndex: number;
  } | null>(null);

  const onDragStart = useCallback(
    (id: string, event: ReactPointerEvent<HTMLDivElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      pointerDragRef.current = {
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
        dragging: false,
        previewIndex: workspaces.findIndex((workspace) => workspace.id === id),
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [workspaces],
  );

  useEffect(() => {
    const previewIndexForPointer = (
      drag: WorkspaceDragState | null,
      clientY: number,
    ) => {
      if (!drag) return 0;
      const rowCenterY = clientY - drag.offsetY + drag.height / 2;
      const siblings = workspaces.filter((workspace) => workspace.id !== drag.id);

      for (let index = 0; index < siblings.length; index += 1) {
        const sibling = containerRef.current?.querySelector<HTMLElement>(
          `[data-workspace-id="${siblings[index].id}"]`,
        );
        if (!sibling) continue;
        const bounds = sibling.getBoundingClientRect();
        if (rowCenterY < bounds.top + bounds.height / 2) return index;
      }
      return siblings.length;
    };

    const onPointerMove = (event: globalThis.PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const moved =
        Math.abs(event.clientX - drag.startX) > 4 ||
        Math.abs(event.clientY - drag.startY) > 4;
      if (!drag.dragging && !moved) return;

      const nextDrag = {
        ...drag,
        dragging: drag.dragging || moved,
        previewIndex: previewIndexForPointer(drag, event.clientY),
      };
      pointerDragRef.current = nextDrag;
      setDragVisual({
        id: nextDrag.id,
        height: nextDrag.height,
        x: event.clientX,
        y: event.clientY,
        previewIndex: nextDrag.previewIndex,
      });
    };

    const onPointerUp = (event: globalThis.PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (drag.dragging && onReorderWorkspaces) {
        const siblings = workspaces.filter((workspace) => workspace.id !== drag.id);
        if (drag.previewIndex >= siblings.length) {
          const lastSibling = siblings[siblings.length - 1];
          if (lastSibling) onReorderWorkspaces(drag.id, lastSibling.id, "after");
        } else {
          const targetSibling = siblings[drag.previewIndex];
          if (targetSibling) onReorderWorkspaces(drag.id, targetSibling.id, "before");
        }
      }

      pointerDragRef.current = null;
      setDragVisual(null);
    };

    const clearDrag = () => {
      pointerDragRef.current = null;
      setDragVisual(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", clearDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", clearDrag);
    };
  }, [containerRef, onReorderWorkspaces, workspaces]);

  return { pointerDragRef, dragVisual, onDragStart };
}

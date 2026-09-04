import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { WorkspaceDirGroup } from "./workspaceDirGroups";

type GroupDragState = {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  offsetY: number;
  height: number;
  dragging: boolean;
  previewIndex: number;
};

export function useWorkspaceGroupReorderDrag({
  groups,
  containerRef,
  onReorderGroup,
}: {
  groups: WorkspaceDirGroup[];
  containerRef: MutableRefObject<HTMLDivElement | null>;
  onReorderGroup?: (
    draggedGroupId: string,
    targetGroupId: string,
    position: "before" | "after",
  ) => void;
}) {
  const groupDragRef = useRef<GroupDragState | null>(null);
  const [groupDragVisual, setGroupDragVisual] = useState<{
    id: string;
    height: number;
    previewIndex: number;
  } | null>(null);

  const onGroupDragStart = useCallback(
    (id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
      const groupElement = event.currentTarget.closest<HTMLElement>(
        "[data-workspace-group-id]",
      );
      const rect = groupElement?.getBoundingClientRect();
      if (!rect) return;
      groupDragRef.current = {
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetY: event.clientY - rect.top,
        height: rect.height,
        dragging: false,
        previewIndex: groups.findIndex((group) => group.id === id),
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [groups],
  );

  useEffect(() => {
    const previewIndexForPointer = (
      drag: GroupDragState,
      clientY: number,
    ) => {
      const groupCenterY = clientY - drag.offsetY + drag.height / 2;
      const siblings = groups.filter((group) => group.id !== drag.id);
      for (let index = 0; index < siblings.length; index += 1) {
        const sibling = containerRef.current?.querySelector<HTMLElement>(
          `[data-workspace-group-id="${siblings[index]!.id}"]`,
        );
        if (!sibling) continue;
        const bounds = sibling.getBoundingClientRect();
        if (groupCenterY < bounds.top + bounds.height / 2) return index;
      }
      return siblings.length;
    };

    const onPointerMove = (event: globalThis.PointerEvent) => {
      const drag = groupDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const moved = Math.abs(event.clientY - drag.startY) > 4;
      if (!drag.dragging && !moved) return;
      const nextDrag = {
        ...drag,
        dragging: true,
        previewIndex: previewIndexForPointer(drag, event.clientY),
      };
      groupDragRef.current = nextDrag;
      setGroupDragVisual({
        id: nextDrag.id,
        height: nextDrag.height,
        previewIndex: nextDrag.previewIndex,
      });
    };

    const onPointerUp = (event: globalThis.PointerEvent) => {
      const drag = groupDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.dragging && onReorderGroup) {
        const siblings = groups.filter((group) => group.id !== drag.id);
        if (drag.previewIndex >= siblings.length) {
          const target = siblings[siblings.length - 1];
          if (target) onReorderGroup(drag.id, target.id, "after");
        } else {
          const target = siblings[drag.previewIndex];
          if (target) onReorderGroup(drag.id, target.id, "before");
        }
      }
      groupDragRef.current = null;
      setGroupDragVisual(null);
    };

    const clearDrag = () => {
      groupDragRef.current = null;
      setGroupDragVisual(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", clearDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", clearDrag);
    };
  }, [containerRef, groups, onReorderGroup]);

  return { groupDragVisual, onGroupDragStart };
}

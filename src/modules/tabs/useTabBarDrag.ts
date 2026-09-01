import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Tab } from "./lib/tabTypes";

export type TabPlacement = "before" | "after";

type PointerDragState = {
  dragging: boolean;
  id: number;
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  x: number;
  y: number;
  previewIndex: number;
};

type DragVisualState = Pick<
  PointerDragState,
  "id" | "width" | "height" | "x" | "y" | "previewIndex"
>;

export function useTabBarDrag({
  tabs,
  scrollRef,
  onSelect,
  onReorder,
}: {
  tabs: Tab[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: number) => void;
  onReorder: (draggedId: number, targetId: number, placement?: TabPlacement) => void;
}) {
  const pointerDragRef = useRef<PointerDragState | null>(null);
  const [dragVisual, setDragVisual] = useState<DragVisualState | null>(null);

  useEffect(() => {
    const previewIndexForPointer = (drag: PointerDragState, clientX: number) => {
      const tabCenterX = clientX - drag.offsetX + drag.width / 2;
      const siblings = tabs.filter((tab) => tab.id !== drag.id);
      for (let index = 0; index < siblings.length; index += 1) {
        const sibling = scrollRef.current?.querySelector<HTMLElement>(
          `[data-tab-id="${siblings[index].id}"]`,
        );
        if (!sibling) continue;
        const bounds = sibling.getBoundingClientRect();
        if (tabCenterX < bounds.left + bounds.width / 2) return index;
      }
      return siblings.length;
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const moved =
        Math.abs(event.clientX - drag.startX) > 4 ||
        Math.abs(event.clientY - drag.startY) > 4;
      if (!drag.dragging && !moved) return;
      const nextDrag: PointerDragState = {
        ...drag,
        dragging: drag.dragging || moved,
        x: event.clientX - drag.offsetX,
        y: event.clientY - drag.offsetY,
        previewIndex: previewIndexForPointer(drag, event.clientX),
      };
      pointerDragRef.current = nextDrag;
      setDragVisual({
        id: nextDrag.id,
        width: nextDrag.width,
        height: nextDrag.height,
        x: nextDrag.x,
        y: nextDrag.y,
        previewIndex: nextDrag.previewIndex,
      });
    };

    const onPointerUp = (event: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (drag.dragging) {
        const siblings = tabs.filter((tab) => tab.id !== drag.id);
        const target =
          drag.previewIndex >= siblings.length
            ? siblings[siblings.length - 1]
            : siblings[drag.previewIndex];
        if (target) {
          onReorder(
            drag.id,
            target.id,
            drag.previewIndex >= siblings.length ? "after" : "before",
          );
        }
      } else {
        onSelect(drag.id);
      }
      pointerDragRef.current = null;
      setDragVisual(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onReorder, onSelect, scrollRef, tabs]);

  const beginDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, id: number) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('[aria-label="Close tab"]')) return;
      const rect = event.currentTarget.getBoundingClientRect();
      pointerDragRef.current = {
        dragging: false,
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
        x: rect.left,
        y: rect.top,
        previewIndex: tabs.findIndex((tab) => tab.id === id),
      };
    },
    [tabs],
  );

  const draggedTab = useMemo(
    () => dragVisual === null ? null : tabs.find((tab) => tab.id === dragVisual.id) ?? null,
    [dragVisual, tabs],
  );
  const renderedTabs = useMemo(
    () => dragVisual === null ? tabs : tabs.filter((tab) => tab.id !== dragVisual.id),
    [dragVisual, tabs],
  );
  const placeholderIndex = dragVisual === null
    ? -1
    : Math.min(Math.max(dragVisual.previewIndex, 0), renderedTabs.length);

  return { dragVisual, draggedTab, renderedTabs, placeholderIndex, beginDrag };
}

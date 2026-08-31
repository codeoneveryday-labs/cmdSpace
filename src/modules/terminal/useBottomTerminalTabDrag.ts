import { useCallback, useEffect, useState, type RefObject } from "react";

type DragState = {
  id: number;
  pointerId: number;
  startX: number;
  dragging: boolean;
};

export function useBottomTerminalTabDrag({
  tabRef,
  focusTab,
  reorderTabs,
}: {
  tabRef: RefObject<DragState | null>;
  focusTab: (id: number) => void;
  reorderTabs: (draggedId: number, targetId: number, placement: "before" | "after") => void;
}) {
  const [draggingTabId, setDraggingTabId] = useState<number | null>(null);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = tabRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (Math.abs(event.clientX - drag.startX) > 4) drag.dragging = true;
      if (drag.dragging) setDraggingTabId(drag.id);
    };

    const onPointerUp = (event: PointerEvent) => {
      const drag = tabRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      tabRef.current = null;
      setDraggingTabId(null);

      if (!drag.dragging) {
        focusTab(drag.id);
        return;
      }

      const target = document.elementFromPoint(event.clientX, event.clientY);
      const targetTab = target instanceof Element
        ? target.closest<HTMLElement>("[data-bottom-terminal-tab]")
        : null;
      const targetId = Number(targetTab?.dataset.bottomTerminalTab);
      if (!Number.isInteger(targetId) || targetId === drag.id || !targetTab) return;
      const rect = targetTab.getBoundingClientRect();
      reorderTabs(
        drag.id,
        targetId,
        event.clientX < rect.left + rect.width / 2 ? "before" : "after",
      );
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [focusTab, reorderTabs, tabRef]);

  const beginDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>, id: number) => {
      if (event.button !== 0) return;
      tabRef.current = {
        id,
        pointerId: event.pointerId,
        startX: event.clientX,
        dragging: false,
      };
    },
    [tabRef],
  );

  return { draggingTabId, beginDrag };
}

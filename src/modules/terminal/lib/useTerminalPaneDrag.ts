import type { TerminalTab } from "@/modules/tabs";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { leafIds, swapLeafNodes, type PaneNode } from "./panes";

export type PaneDragContext = {
  draggingId: number | null;
  targetId: number | null;
  targetOffset: { x: number; y: number } | null;
  onDragStart: (
    leafId: number,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
};

type PaneDragState = {
  tabId: number;
  sourceId: number;
  targetId: number | null;
  targetOffset: { x: number; y: number } | null;
};

type PaneSwapRect = Pick<DOMRect, "left" | "top" | "width" | "height">;

export function paneSwapPreviewOffset(
  source: PaneSwapRect,
  target: PaneSwapRect,
): { x: number; y: number } {
  const towardSource = (sourceCenter: number, targetCenter: number) =>
    Math.max(-12, Math.min(12, Math.sign(sourceCenter - targetCenter) * 10));

  return {
    x: towardSource(source.left + source.width / 2, target.left + target.width / 2),
    y: towardSource(source.top + source.height / 2, target.top + target.height / 2),
  };
}

export function useTerminalPaneDrag({
  activeTerminal,
  terminals,
  onFocusLeaf,
  onPaneTreeChange,
}: {
  activeTerminal: TerminalTab | null;
  terminals: readonly TerminalTab[];
  onFocusLeaf: (tabId: number, leafId: number) => void;
  onPaneTreeChange: (tabId: number, paneTree: PaneNode) => void;
}): PaneDragContext {
  const [dragState, setDragState] = useState<PaneDragState | null>(null);
  const dragStateRef = useRef(dragState);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  dragStateRef.current = dragState;

  const finishPaneDrag = useCallback(
    (commit: boolean, targetOverride?: number | null) => {
      const activeDrag = dragStateRef.current;
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
      setDragState(null);
      if (!commit || !activeDrag) return;

      const tab = terminals.find((candidate) => candidate.id === activeDrag.tabId);
      const targetId =
        targetOverride === undefined ? activeDrag.targetId : targetOverride;
      if (targetId === null || !tab || targetId === activeDrag.sourceId) return;

      const nextTree = swapLeafNodes(tab.paneTree, activeDrag.sourceId, targetId);
      if (nextTree === tab.paneTree) return;
      onPaneTreeChange(tab.id, nextTree);
      onFocusLeaf(tab.id, activeDrag.sourceId);
    },
    [onFocusLeaf, onPaneTreeChange, terminals],
  );

  const startPaneDrag = useCallback(
    (sourceId: number, event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        event.button !== 0 ||
        (event.target instanceof Element && event.target.closest("button"))
      ) {
        return;
      }
      const tab = activeTerminal;
      if (!tab || leafIds(tab.paneTree).length < 2) return;

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      finishPaneDrag(false);

      const pointerId = event.pointerId;
      const ownerDocument = event.currentTarget.ownerDocument;
      const ownerWindow = ownerDocument.defaultView ?? window;
      const updateTarget = (point: { clientX: number; clientY: number }) => {
        const hit = ownerDocument
          .elementsFromPoint(point.clientX, point.clientY)
          .map((element) => element.closest<HTMLElement>("[data-pane-leaf]"))
          .find((element): element is HTMLElement => element !== null);
        const candidateId = hit ? Number(hit.dataset.paneLeaf) : null;
        const targetId =
          candidateId !== null && leafIds(tab.paneTree).includes(candidateId)
            ? candidateId
            : null;
        const normalizedTargetId = targetId === sourceId ? null : targetId;
        const source = ownerDocument.querySelector<HTMLElement>(
          `[data-pane-leaf="${sourceId}"]`,
        );
        const targetOffset =
          normalizedTargetId !== null && source && hit
            ? paneSwapPreviewOffset(
                source.getBoundingClientRect(),
                hit.getBoundingClientRect(),
              )
            : null;
        setDragState((current) =>
          current && current.targetId === normalizedTargetId
            ? current
            : current
              ? { ...current, targetId: normalizedTargetId, targetOffset }
              : current,
        );
        return normalizedTargetId;
      };
      const handlePointerMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== pointerId) return;
        moveEvent.preventDefault();
        updateTarget(moveEvent);
      };
      const handlePointerUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== pointerId) return;
        finishPaneDrag(true, updateTarget(upEvent));
      };
      const handleKeyDown = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== "Escape") return;
        keyEvent.preventDefault();
        finishPaneDrag(false);
      };
      const cancel = () => finishPaneDrag(false);

      ownerDocument.addEventListener("pointermove", handlePointerMove);
      ownerDocument.addEventListener("pointerup", handlePointerUp);
      ownerDocument.addEventListener("pointercancel", cancel);
      ownerDocument.addEventListener("keydown", handleKeyDown);
      ownerWindow.addEventListener("blur", cancel);
      dragCleanupRef.current = () => {
        ownerDocument.removeEventListener("pointermove", handlePointerMove);
        ownerDocument.removeEventListener("pointerup", handlePointerUp);
        ownerDocument.removeEventListener("pointercancel", cancel);
        ownerDocument.removeEventListener("keydown", handleKeyDown);
        ownerWindow.removeEventListener("blur", cancel);
      };
      setDragState({
        tabId: tab.id,
        sourceId,
        targetId: null,
        targetOffset: null,
      });
    },
    [activeTerminal, finishPaneDrag],
  );

  useEffect(() => () => dragCleanupRef.current?.(), []);

  return {
    draggingId: dragState?.sourceId ?? null,
    targetId: dragState?.targetId ?? null,
    targetOffset: dragState?.targetOffset ?? null,
    onDragStart: startPaneDrag,
  };
}

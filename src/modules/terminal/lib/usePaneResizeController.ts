import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react";
import type { GroupImperativeHandle } from "react-resizable-panels";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { setTerminalResizePaused } from "./rendererPool";
import { commitPaneLayout, resizeAdjacentPanes } from "./paneResizeModel";
import type { PaneNode, SplitDir } from "./panes";

const PANE_RESIZE_RESUME_DELAY_MS = 48;
const PANE_SPLIT_MIN_SIZE = 10;

type PaneResizeControllerProps = {
  groupRef: MutableRefObject<GroupImperativeHandle | null>;
  children: PaneNode[];
  direction: SplitDir;
  onCommit: (children: PaneNode[]) => void;
};

export function usePaneResizeController({
  groupRef,
  children,
  direction,
  onCommit,
}: PaneResizeControllerProps) {
  const paneResizeResumeTimerRef = useRef<number | null>(null);
  const paneResizeDragCleanupRef = useRef<(() => void) | null>(null);
  const isHorizontalGroup = direction === "row";

  const clearPaneResizeResumeTimer = useCallback(() => {
    if (paneResizeResumeTimerRef.current === null) return;
    window.clearTimeout(paneResizeResumeTimerRef.current);
    paneResizeResumeTimerRef.current = null;
  }, []);

  const resumeTerminalResizeAfterPaneDrag = useCallback(() => {
    clearPaneResizeResumeTimer();
    paneResizeResumeTimerRef.current = window.setTimeout(() => {
      paneResizeResumeTimerRef.current = null;
      requestAnimationFrame(() => {
        setTerminalResizePaused(false);
      });
    }, PANE_RESIZE_RESUME_DELAY_MS);
  }, [clearPaneResizeResumeTimer]);

  useEffect(() => {
    return () => {
      paneResizeDragCleanupRef.current?.();
      clearPaneResizeResumeTimer();
      setTerminalResizePaused(false);
    };
  }, [clearPaneResizeResumeTimer]);

  const getGroupSize = useCallback(
    (groupElement: HTMLElement): number =>
      Array.from(groupElement.children).reduce((size, child) => {
        if (!(child instanceof HTMLElement)) return size;
        if (!child.hasAttribute("data-panel")) return size;
        return size + (isHorizontalGroup ? child.offsetWidth : child.offsetHeight);
      }, 0),
    [isHorizontalGroup],
  );

  const applyAdjacentPaneDelta = useCallback(
    (
      nextIndex: number,
      deltaPercent: number,
      baseLayout = groupRef.current?.getLayout(),
    ): Record<string, number> | undefined => {
      const group = groupRef.current;
      if (!group || !baseLayout) return undefined;

      const previousChild = children[nextIndex - 1];
      const nextChild = children[nextIndex];
      if (!previousChild || !nextChild) return undefined;

      const resizedLayout = resizeAdjacentPanes(
        baseLayout,
        `pane-${previousChild.id}`,
        `pane-${nextChild.id}`,
        deltaPercent,
        PANE_SPLIT_MIN_SIZE,
      );
      return resizedLayout ? group.setLayout(resizedLayout) : undefined;
    },
    [children, groupRef],
  );

  const commitSplitLayout = useCallback(
    (layout: Record<string, number> | undefined) => {
      if (!layout) return;
      const result = commitPaneLayout(children, layout);
      if (result.changed) onCommit(result.children);
    },
    [children, onCommit],
  );

  const startPaneResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>, nextIndex: number) => {
      if (event.button !== 0) return;

      const group = groupRef.current;
      const groupElement = event.currentTarget.parentElement;
      if (!group || !(groupElement instanceof HTMLElement)) return;

      const groupSize = getGroupSize(groupElement);
      if (groupSize <= 0) return;

      const startPoint = isHorizontalGroup ? event.clientX : event.clientY;
      const initialLayout = group.getLayout();
      const ownerDocument = event.currentTarget.ownerDocument;
      const ownerWindow = ownerDocument.defaultView ?? window;
      const target = event.currentTarget;
      const dragCursor = isHorizontalGroup ? "col-resize" : "row-resize";
      const previousBodyCursor = ownerDocument.body.style.cursor;
      const previousRootCursor = ownerDocument.documentElement.style.cursor;
      const previousUserSelect = ownerDocument.body.style.userSelect;
      let latestLayout = initialLayout;
      let latestPoint = startPoint;
      let frameId: number | null = null;

      event.preventDefault();
      event.stopPropagation();
      target.setPointerCapture?.(event.pointerId);

      paneResizeDragCleanupRef.current?.();
      clearPaneResizeResumeTimer();
      setTerminalResizePaused(true);
      ownerDocument.body.style.cursor = dragCursor;
      ownerDocument.documentElement.style.cursor = dragCursor;
      ownerDocument.body.style.userSelect = "none";

      const applyLatestPoint = () => {
        frameId = null;
        const zoomLevel = usePreferencesStore.getState().zoomLevel || 1;
        const deltaPercent =
          ((latestPoint - startPoint) / zoomLevel / groupSize) * 100;
        latestLayout =
          applyAdjacentPaneDelta(nextIndex, deltaPercent, initialLayout) ??
          latestLayout;
      };

      const scheduleApply = () => {
        if (frameId !== null) return;
        frameId = ownerWindow.requestAnimationFrame(applyLatestPoint);
      };

      const finish = () => {
        ownerDocument.removeEventListener("pointermove", handlePointerMove);
        ownerDocument.removeEventListener("pointerup", finish);
        ownerDocument.removeEventListener("pointercancel", finish);
        ownerWindow.removeEventListener("blur", finish);
        if (frameId !== null) {
          ownerWindow.cancelAnimationFrame(frameId);
          frameId = null;
          applyLatestPoint();
        }
        target.releasePointerCapture?.(event.pointerId);
        ownerDocument.body.style.cursor = previousBodyCursor;
        ownerDocument.documentElement.style.cursor = previousRootCursor;
        ownerDocument.body.style.userSelect = previousUserSelect;
        if (paneResizeDragCleanupRef.current === finish) {
          paneResizeDragCleanupRef.current = null;
        }
        commitSplitLayout(latestLayout);
        resumeTerminalResizeAfterPaneDrag();
      };

      const handlePointerMove = (moveEvent: PointerEvent) => {
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        latestPoint = isHorizontalGroup ? moveEvent.clientX : moveEvent.clientY;
        scheduleApply();
      };

      ownerDocument.addEventListener("pointermove", handlePointerMove);
      ownerDocument.addEventListener("pointerup", finish);
      ownerDocument.addEventListener("pointercancel", finish);
      ownerWindow.addEventListener("blur", finish);
      paneResizeDragCleanupRef.current = finish;
    },
    [
      applyAdjacentPaneDelta,
      clearPaneResizeResumeTimer,
      commitSplitLayout,
      getGroupSize,
      groupRef,
      isHorizontalGroup,
      resumeTerminalResizeAfterPaneDrag,
    ],
  );

  const handleResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>, nextIndex: number) => {
      const increment = event.shiftKey ? 10 : 5;
      const keyToDelta: Record<string, number | undefined> = isHorizontalGroup
        ? { ArrowLeft: -increment, ArrowRight: increment }
        : { ArrowUp: -increment, ArrowDown: increment };
      const delta = keyToDelta[event.key];
      if (delta === undefined) return;

      event.preventDefault();
      clearPaneResizeResumeTimer();
      setTerminalResizePaused(true);
      commitSplitLayout(applyAdjacentPaneDelta(nextIndex, delta));
      resumeTerminalResizeAfterPaneDrag();
    },
    [
      applyAdjacentPaneDelta,
      clearPaneResizeResumeTimer,
      commitSplitLayout,
      isHorizontalGroup,
      resumeTerminalResizeAfterPaneDrag,
    ],
  );

  return {
    startPaneResize,
    handleResizeKeyDown,
  };
}

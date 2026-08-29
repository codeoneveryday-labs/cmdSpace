import {
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type MutableRefObject,
} from "react";
import {
  CHROME_RESIZE_TRANSITION_MS,
  SIDEBAR_COLLAPSE_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
  WORKSPACE_MIN_WIDTH,
  WORKSPACES_PANEL_COLLAPSE_WIDTH,
  WORKSPACES_PANEL_MAX_WIDTH,
  WORKSPACES_PANEL_MIN_WIDTH,
  WORKSPACES_PANEL_WIDTH_STORAGE_KEY,
} from "../constants";

function clampSidebarWidth(width: number, containerWidth?: number): number {
  const maxWidth =
    containerWidth && Number.isFinite(containerWidth)
      ? Math.max(
          SIDEBAR_MIN_WIDTH,
          Math.min(SIDEBAR_MAX_WIDTH, containerWidth - WORKSPACE_MIN_WIDTH),
        )
      : SIDEBAR_MAX_WIDTH;
  return Math.min(maxWidth, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

function clampWorkspacesPanelWidth(
  width: number,
  containerWidth?: number,
  sidebarWidth = 0,
): number {
  const maxWidth =
    containerWidth && Number.isFinite(containerWidth)
      ? Math.max(
          WORKSPACES_PANEL_MIN_WIDTH,
          Math.min(
            WORKSPACES_PANEL_MAX_WIDTH,
            containerWidth - sidebarWidth - WORKSPACE_MIN_WIDTH,
          ),
        )
      : WORKSPACES_PANEL_MAX_WIDTH;
  return Math.min(
    maxWidth,
    Math.max(WORKSPACES_PANEL_MIN_WIDTH, Math.round(width)),
  );
}

type ResizeStart = { open: boolean; pointerX: number; width: number };

type AppLayoutResizePorts = {
  mainShellRef: MutableRefObject<HTMLDivElement | null>;
  sidebarSplitRef: MutableRefObject<HTMLDivElement | null>;
  sidebarResizeStartRef: MutableRefObject<ResizeStart | null>;
  workspacesPanelResizeStartRef: MutableRefObject<ResizeStart | null>;
  sidebarOpen: boolean;
  sidebarWidth: number;
  workspacesPanelOpen: boolean;
  workspacesPanelCompact: boolean;
  workspacesPanelWidth: number;
  workspacesPanelResizing: boolean;
  sidebarResizing: boolean;
  sidebarWidthRef: MutableRefObject<number>;
  workspacesPanelWidthRef: MutableRefObject<number>;
  setSidebarOpen: (value: boolean | ((value: boolean) => boolean)) => void;
  setSidebarWidth: (value: number) => void;
  setSidebarResizing: (value: boolean) => void;
  setWorkspacesPanelOpen: (value: boolean | ((value: boolean) => boolean)) => void;
  setWorkspacesPanelExpandedWidth: (value: number) => void;
  setWorkspacesPanelResizing: (value: boolean) => void;
  setTerminalResizePaused: (value: boolean) => void;
};

export function useAppLayoutResize({
  mainShellRef,
  sidebarSplitRef,
  sidebarResizeStartRef,
  workspacesPanelResizeStartRef,
  sidebarOpen,
  sidebarWidth,
  workspacesPanelOpen,
  workspacesPanelCompact,
  workspacesPanelWidth,
  workspacesPanelResizing,
  sidebarResizing,
  sidebarWidthRef,
  workspacesPanelWidthRef,
  setSidebarOpen,
  setSidebarWidth,
  setSidebarResizing,
  setWorkspacesPanelOpen,
  setWorkspacesPanelExpandedWidth,
  setWorkspacesPanelResizing,
  setTerminalResizePaused,
}: AppLayoutResizePorts) {
  const terminalResizeResumeTimerRef = useRef<number | null>(null);
  const clearTerminalResizeResumeTimer = useCallback(() => {
    if (terminalResizeResumeTimerRef.current === null) return;
    window.clearTimeout(terminalResizeResumeTimerRef.current);
    terminalResizeResumeTimerRef.current = null;
  }, []);
  const pauseTerminalResizeForChromeTransition = useCallback(() => {
    clearTerminalResizeResumeTimer();
    setTerminalResizePaused(true);
    terminalResizeResumeTimerRef.current = window.setTimeout(() => {
      terminalResizeResumeTimerRef.current = null;
      requestAnimationFrame(() => {
        if (!sidebarResizeStartRef.current) setTerminalResizePaused(false);
      });
    }, CHROME_RESIZE_TRANSITION_MS);
  }, [clearTerminalResizeResumeTimer, setTerminalResizePaused, sidebarResizeStartRef]);
  useEffect(() => () => {
    clearTerminalResizeResumeTimer();
    setTerminalResizePaused(false);
  }, [clearTerminalResizeResumeTimer, setTerminalResizePaused]);

  const rememberSidebarWidth = useCallback((next: number) => {
    const containerWidth = sidebarSplitRef.current?.getBoundingClientRect().width;
    const width = clampSidebarWidth(next, containerWidth);
    sidebarWidthRef.current = width;
    setSidebarWidth(width);
  }, [setSidebarWidth, sidebarSplitRef, sidebarWidthRef]);
  const persistRememberedSidebarWidth = useCallback(() => {
    try { window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(sidebarWidthRef.current)); } catch { /* optional */ }
  }, [sidebarWidthRef]);
  const rememberWorkspacesPanelWidth = useCallback((next: number) => {
    const containerWidth = mainShellRef.current?.getBoundingClientRect().width;
    const width = clampWorkspacesPanelWidth(next, containerWidth, sidebarOpen ? sidebarWidthRef.current : 0);
    workspacesPanelWidthRef.current = width;
    setWorkspacesPanelExpandedWidth(width);
  }, [mainShellRef, setWorkspacesPanelExpandedWidth, sidebarOpen, sidebarWidthRef, workspacesPanelWidthRef]);
  const persistRememberedWorkspacesPanelWidth = useCallback(() => {
    try { window.localStorage.setItem(WORKSPACES_PANEL_WIDTH_STORAGE_KEY, String(workspacesPanelWidthRef.current)); } catch { /* optional */ }
  }, [workspacesPanelWidthRef]);
  const resumeTerminalResizeAfterSidebarDrag = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!sidebarResizeStartRef.current && !workspacesPanelResizeStartRef.current) setTerminalResizePaused(false);
    }));
  }, [setTerminalResizePaused, sidebarResizeStartRef, workspacesPanelResizeStartRef]);
  const collapseWorkspacesPanelFromResize = useCallback(() => {
    workspacesPanelResizeStartRef.current = null;
    setWorkspacesPanelOpen(false);
    persistRememberedWorkspacesPanelWidth();
    resumeTerminalResizeAfterSidebarDrag();
    requestAnimationFrame(() => setWorkspacesPanelResizing(false));
  }, [persistRememberedWorkspacesPanelWidth, resumeTerminalResizeAfterSidebarDrag, setWorkspacesPanelOpen, setWorkspacesPanelResizing, workspacesPanelResizeStartRef]);
  const collapseSidebarFromResize = useCallback(() => {
    sidebarResizeStartRef.current = null;
    setSidebarOpen(false);
    persistRememberedSidebarWidth();
    resumeTerminalResizeAfterSidebarDrag();
    requestAnimationFrame(() => setSidebarResizing(false));
  }, [persistRememberedSidebarWidth, resumeTerminalResizeAfterSidebarDrag, setSidebarOpen, setSidebarResizing, sidebarResizeStartRef]);

  const handleWorkspacesPanelResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (workspacesPanelCompact) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    clearTerminalResizeResumeTimer();
    setTerminalResizePaused(true);
    workspacesPanelResizeStartRef.current = { open: workspacesPanelOpen, pointerX: event.clientX, width: workspacesPanelOpen ? workspacesPanelWidthRef.current : 0 };
    setWorkspacesPanelResizing(true);
  }, [clearTerminalResizeResumeTimer, setTerminalResizePaused, setWorkspacesPanelResizing, workspacesPanelCompact, workspacesPanelOpen, workspacesPanelResizeStartRef, workspacesPanelWidthRef]);
  const handleWorkspacesPanelResizeMove = useCallback((event: PointerEvent) => {
    const start = workspacesPanelResizeStartRef.current;
    if (!start || workspacesPanelCompact) return;
    event.preventDefault();
    const nextWidth = start.width + event.clientX - start.pointerX;
    if (!start.open) {
      if (nextWidth > WORKSPACES_PANEL_COLLAPSE_WIDTH) { setWorkspacesPanelOpen(true); rememberWorkspacesPanelWidth(nextWidth); }
      return;
    }
    if (nextWidth <= WORKSPACES_PANEL_COLLAPSE_WIDTH) { collapseWorkspacesPanelFromResize(); return; }
    rememberWorkspacesPanelWidth(nextWidth);
  }, [collapseWorkspacesPanelFromResize, rememberWorkspacesPanelWidth, setWorkspacesPanelOpen, workspacesPanelCompact, workspacesPanelResizeStartRef]);
  const handleWorkspacesPanelResizeEnd = useCallback(() => {
    if (!workspacesPanelResizeStartRef.current) return;
    workspacesPanelResizeStartRef.current = null;
    setWorkspacesPanelResizing(false);
    persistRememberedWorkspacesPanelWidth();
    resumeTerminalResizeAfterSidebarDrag();
  }, [persistRememberedWorkspacesPanelWidth, resumeTerminalResizeAfterSidebarDrag, setWorkspacesPanelResizing, workspacesPanelResizeStartRef]);
  const handleSidebarResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    clearTerminalResizeResumeTimer();
    setTerminalResizePaused(true);
    sidebarResizeStartRef.current = { open: sidebarOpen, pointerX: event.clientX, width: sidebarOpen ? sidebarWidthRef.current : 0 };
    setSidebarResizing(true);
  }, [clearTerminalResizeResumeTimer, setSidebarResizing, setTerminalResizePaused, sidebarOpen, sidebarResizeStartRef, sidebarWidthRef]);
  const handleSidebarResizeMove = useCallback((event: PointerEvent) => {
    const start = sidebarResizeStartRef.current;
    if (!start) return;
    event.preventDefault();
    const nextWidth = start.width - event.clientX + start.pointerX;
    if (!start.open) {
      if (nextWidth > SIDEBAR_COLLAPSE_WIDTH) { setSidebarOpen(true); rememberSidebarWidth(nextWidth); }
      return;
    }
    if (nextWidth <= SIDEBAR_COLLAPSE_WIDTH) { collapseSidebarFromResize(); return; }
    rememberSidebarWidth(nextWidth);
  }, [collapseSidebarFromResize, rememberSidebarWidth, setSidebarOpen, sidebarResizeStartRef]);
  const handleSidebarResizeEnd = useCallback(() => {
    if (!sidebarResizeStartRef.current) return;
    sidebarResizeStartRef.current = null;
    setSidebarResizing(false);
    persistRememberedSidebarWidth();
    resumeTerminalResizeAfterSidebarDrag();
  }, [persistRememberedSidebarWidth, resumeTerminalResizeAfterSidebarDrag, setSidebarResizing, sidebarResizeStartRef]);
  useEffect(() => {
    if (!workspacesPanelResizing) return;
    window.addEventListener("pointermove", handleWorkspacesPanelResizeMove);
    window.addEventListener("pointerup", handleWorkspacesPanelResizeEnd);
    window.addEventListener("pointercancel", handleWorkspacesPanelResizeEnd);
    window.addEventListener("blur", handleWorkspacesPanelResizeEnd);
    return () => {
      window.removeEventListener("pointermove", handleWorkspacesPanelResizeMove);
      window.removeEventListener("pointerup", handleWorkspacesPanelResizeEnd);
      window.removeEventListener("pointercancel", handleWorkspacesPanelResizeEnd);
      window.removeEventListener("blur", handleWorkspacesPanelResizeEnd);
    };
  }, [handleWorkspacesPanelResizeEnd, handleWorkspacesPanelResizeMove, workspacesPanelResizing]);
  useEffect(() => {
    if (!sidebarResizing) return;
    window.addEventListener("pointermove", handleSidebarResizeMove);
    window.addEventListener("pointerup", handleSidebarResizeEnd);
    window.addEventListener("pointercancel", handleSidebarResizeEnd);
    window.addEventListener("blur", handleSidebarResizeEnd);
    return () => {
      window.removeEventListener("pointermove", handleSidebarResizeMove);
      window.removeEventListener("pointerup", handleSidebarResizeEnd);
      window.removeEventListener("pointercancel", handleSidebarResizeEnd);
      window.removeEventListener("blur", handleSidebarResizeEnd);
    };
  }, [handleSidebarResizeEnd, handleSidebarResizeMove, sidebarResizing]);

  const nudgeWorkspacesPanelWidth = useCallback((delta: number) => {
    if (workspacesPanelCompact) return;
    const nextWidth = (workspacesPanelOpen ? workspacesPanelWidth : 0) + delta;
    if (nextWidth <= WORKSPACES_PANEL_COLLAPSE_WIDTH) { setWorkspacesPanelOpen(false); persistRememberedWorkspacesPanelWidth(); return; }
    setWorkspacesPanelOpen(true); rememberWorkspacesPanelWidth(nextWidth); persistRememberedWorkspacesPanelWidth();
  }, [persistRememberedWorkspacesPanelWidth, rememberWorkspacesPanelWidth, setWorkspacesPanelOpen, workspacesPanelCompact, workspacesPanelOpen, workspacesPanelWidth]);
  const handleWorkspacesPanelResizeKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (workspacesPanelCompact) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); nudgeWorkspacesPanelWidth(-16); }
    else if (event.key === "ArrowRight") { event.preventDefault(); nudgeWorkspacesPanelWidth(16); }
    else if (event.key === "Home") { event.preventDefault(); setWorkspacesPanelOpen(true); rememberWorkspacesPanelWidth(WORKSPACES_PANEL_MIN_WIDTH); persistRememberedWorkspacesPanelWidth(); }
    else if (event.key === "End") { event.preventDefault(); setWorkspacesPanelOpen(true); rememberWorkspacesPanelWidth(WORKSPACES_PANEL_MAX_WIDTH); persistRememberedWorkspacesPanelWidth(); }
  }, [nudgeWorkspacesPanelWidth, persistRememberedWorkspacesPanelWidth, rememberWorkspacesPanelWidth, setWorkspacesPanelOpen, workspacesPanelCompact]);
  const handleSidebarResizeKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); setSidebarOpen(true); rememberSidebarWidth((sidebarOpen ? sidebarWidth : 0) + 16); persistRememberedSidebarWidth(); }
    else if (event.key === "ArrowRight") { event.preventDefault(); const nextWidth = (sidebarOpen ? sidebarWidth : 0) - 16; if (nextWidth <= SIDEBAR_COLLAPSE_WIDTH) { setSidebarOpen(false); persistRememberedSidebarWidth(); return; } setSidebarOpen(true); rememberSidebarWidth(nextWidth); persistRememberedSidebarWidth(); }
    else if (event.key === "Home") { event.preventDefault(); setSidebarOpen(true); rememberSidebarWidth(SIDEBAR_MIN_WIDTH); persistRememberedSidebarWidth(); }
    else if (event.key === "End") { event.preventDefault(); setSidebarOpen(true); rememberSidebarWidth(SIDEBAR_MAX_WIDTH); persistRememberedSidebarWidth(); }
  }, [persistRememberedSidebarWidth, rememberSidebarWidth, setSidebarOpen, sidebarOpen, sidebarWidth]);

  return {
    pauseTerminalResizeForChromeTransition,
    handleWorkspacesPanelResizeStart,
    handleWorkspacesPanelResizeKeyDown,
    handleSidebarResizeStart,
    handleSidebarResizeKeyDown,
  };
}

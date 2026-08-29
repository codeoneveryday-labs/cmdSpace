import type { EditorSidebarViewId, SidebarViewId } from "@/modules/sidebar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_BROWSER_URL_STORAGE_KEY,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_VIEW_STORAGE_KEY,
  SIDEBAR_WIDTH_STORAGE_KEY,
  WORKSPACES_PANEL_COMPACT_BREAKPOINT,
  WORKSPACES_PANEL_MAX_WIDTH,
  WORKSPACES_PANEL_MIN_WIDTH,
  WORKSPACES_PANEL_WIDTH,
  WORKSPACES_PANEL_WIDTH_STORAGE_KEY,
} from "../constants";

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
            containerWidth - sidebarWidth - 260,
          ),
        )
      : WORKSPACES_PANEL_MAX_WIDTH;
  return Math.min(
    maxWidth,
    Math.max(WORKSPACES_PANEL_MIN_WIDTH, Math.round(width)),
  );
}

function readNumber(key: string, fallback: number): number {
  try {
    const value = Number.parseInt(window.localStorage.getItem(key) ?? "", 10);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function readSidebarWidth(): number {
  return Math.min(
    SIDEBAR_MAX_WIDTH,
    Math.max(
      SIDEBAR_MIN_WIDTH,
      readNumber(SIDEBAR_WIDTH_STORAGE_KEY, SIDEBAR_DEFAULT_WIDTH),
    ),
  );
}

function readWorkspacesPanelWidth(): number {
  return Math.min(
    WORKSPACES_PANEL_MAX_WIDTH,
    Math.max(
      WORKSPACES_PANEL_MIN_WIDTH,
      readNumber(WORKSPACES_PANEL_WIDTH_STORAGE_KEY, WORKSPACES_PANEL_WIDTH),
    ),
  );
}

function readSidebarView(): SidebarViewId {
  try {
    const stored = window.localStorage.getItem(SIDEBAR_VIEW_STORAGE_KEY);
    if (stored === "browser" || stored === "editor") return stored;
    if (stored === "explorer" || stored === "source-control") return "editor";
  } catch {
    // Storage is optional.
  }
  return "browser";
}

function readSidebarBrowserUrl(): string {
  try {
    return window.localStorage.getItem(SIDEBAR_BROWSER_URL_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export type AppLayoutState = ReturnType<typeof useAppLayout>;

export function useAppLayout() {
  const mainShellRef = useRef<HTMLDivElement | null>(null);
  const sidebarSplitRef = useRef<HTMLDivElement | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [sidebarView, setSidebarViewState] = useState<SidebarViewId>(readSidebarView);
  const [editorSidebarView, setEditorSidebarView] =
    useState<EditorSidebarViewId>("files");
  const [sidebarBrowserUrl, setSidebarBrowserUrl] = useState(readSidebarBrowserUrl);
  const [workspacesPanelOpen, setWorkspacesPanelOpen] = useState(true);
  const [workspacesPanelResizing, setWorkspacesPanelResizing] = useState(false);
  const [workspacesPanelExpandedWidth, setWorkspacesPanelExpandedWidth] =
    useState(readWorkspacesPanelWidth);
  const [workspacesPanelCompact, setWorkspacesPanelCompact] = useState(() =>
    typeof window === "undefined"
      ? false
      : window.innerWidth < WORKSPACES_PANEL_COMPACT_BREAKPOINT,
  );
  const sidebarWidthRef = useRef(sidebarWidth);
  const workspacesPanelWidthRef = useRef(workspacesPanelExpandedWidth);

  useEffect(() => {
    const shell = mainShellRef.current;
    const updateWorkspacesPanelMode = (width?: number) => {
      const nextWidth =
        width ?? shell?.getBoundingClientRect().width ?? window.innerWidth;
      setWorkspacesPanelCompact(nextWidth < WORKSPACES_PANEL_COMPACT_BREAKPOINT);
      const clampedWidth = clampWorkspacesPanelWidth(
        workspacesPanelWidthRef.current,
        nextWidth,
        sidebarOpen ? sidebarWidthRef.current : 0,
      );
      if (clampedWidth !== workspacesPanelWidthRef.current) {
        workspacesPanelWidthRef.current = clampedWidth;
        setWorkspacesPanelExpandedWidth(clampedWidth);
      }
    };

    updateWorkspacesPanelMode();
    const onWindowResize = () => updateWorkspacesPanelMode();
    if (!shell || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", onWindowResize);
      return () => window.removeEventListener("resize", onWindowResize);
    }
    const resizeObserver = new ResizeObserver((entries) => {
      updateWorkspacesPanelMode(entries[0]?.contentRect.width);
    });
    resizeObserver.observe(shell);
    window.addEventListener("resize", onWindowResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", onWindowResize);
    };
  }, [sidebarOpen]);
  const persistSidebarView = useCallback((view: SidebarViewId) => {
    setSidebarViewState(view);
    try {
      window.localStorage.setItem(SIDEBAR_VIEW_STORAGE_KEY, view);
    } catch {
      // Storage is optional.
    }
  }, []);
  const persistSidebarBrowserUrl = useCallback((url: string) => {
    setSidebarBrowserUrl(url);
    try {
      window.localStorage.setItem(SIDEBAR_BROWSER_URL_STORAGE_KEY, url);
    } catch {
      // Storage is optional.
    }
  }, []);

  return {
    mainShellRef,
    sidebarSplitRef,
    sidebarOpen,
    setSidebarOpen,
    sidebarWidth,
    setSidebarWidth,
    sidebarResizing,
    setSidebarResizing,
    sidebarView,
    setSidebarViewState,
    persistSidebarView,
    editorSidebarView,
    setEditorSidebarView,
    sidebarBrowserUrl,
    setSidebarBrowserUrl,
    persistSidebarBrowserUrl,
    workspacesPanelOpen,
    setWorkspacesPanelOpen,
    workspacesPanelResizing,
    setWorkspacesPanelResizing,
    workspacesPanelExpandedWidth,
    setWorkspacesPanelExpandedWidth,
    workspacesPanelCompact,
    setWorkspacesPanelCompact,
    sidebarWidthRef,
    workspacesPanelWidthRef,
    sidebarResizeStartRef: useRef<{
      open: boolean;
      pointerX: number;
      width: number;
    } | null>(null),
    workspacesPanelResizeStartRef: useRef<{
      open: boolean;
      pointerX: number;
      width: number;
    } | null>(null),
  };
}

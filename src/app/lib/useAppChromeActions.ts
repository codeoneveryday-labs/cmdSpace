import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import type { FileExplorerHandle } from "@/modules/explorer";
import type { SidebarViewId } from "@/modules/sidebar";

export function useAppChromeActions({
  pauseTerminalResizeForChromeTransition,
  sidebarOpen,
  setSidebarOpen,
  workspacesPanelOpen,
  setWorkspacesPanelOpen,
  sidebarView,
  persistSidebarView,
  explorerRef,
  explorerReturnFocusRef,
}: {
  pauseTerminalResizeForChromeTransition: () => void;
  sidebarOpen: boolean;
  setSidebarOpen: Dispatch<SetStateAction<boolean>>;
  workspacesPanelOpen: boolean;
  setWorkspacesPanelOpen: Dispatch<SetStateAction<boolean>>;
  sidebarView: SidebarViewId;
  persistSidebarView: (view: SidebarViewId) => void;
  explorerRef: MutableRefObject<FileExplorerHandle | null>;
  explorerReturnFocusRef: MutableRefObject<HTMLElement | null>;
}) {
  const toggleSidebar = useCallback(() => {
    pauseTerminalResizeForChromeTransition();
    setSidebarOpen((open) => !open);
  }, [pauseTerminalResizeForChromeTransition, setSidebarOpen]);

  const toggleWorkspacesPanel = useCallback(() => {
    pauseTerminalResizeForChromeTransition();
    setWorkspacesPanelOpen((open) => !open);
  }, [pauseTerminalResizeForChromeTransition, setWorkspacesPanelOpen]);

  const canvasFocused = !workspacesPanelOpen && !sidebarOpen;
  const toggleCanvasFocus = useCallback(() => {
    pauseTerminalResizeForChromeTransition();
    if (!canvasFocused) {
      setWorkspacesPanelOpen(false);
      setSidebarOpen(false);
      return;
    }
    setWorkspacesPanelOpen(true);
    setSidebarOpen(true);
  }, [canvasFocused, pauseTerminalResizeForChromeTransition, setSidebarOpen, setWorkspacesPanelOpen]);

  const cycleSidebarView = useCallback(
    (view: SidebarViewId) => {
      if (view !== sidebarView) {
        if (!sidebarOpen) pauseTerminalResizeForChromeTransition();
        setSidebarOpen(true);
        persistSidebarView(view);
        return;
      }
      pauseTerminalResizeForChromeTransition();
      setSidebarOpen((open) => !open);
    },
    [
      pauseTerminalResizeForChromeTransition,
      persistSidebarView,
      setSidebarOpen,
      sidebarOpen,
      sidebarView,
    ],
  );

  const toggleExplorerFocus = useCallback(() => {
    const explorer = explorerRef.current;
    if (sidebarView !== "editor" || !sidebarOpen) {
      if (!sidebarOpen) setSidebarOpen(true);
      if (sidebarView !== "editor") persistSidebarView("editor");
      const active = document.activeElement;
      explorerReturnFocusRef.current =
        active instanceof HTMLElement && active !== document.body ? active : null;
      requestAnimationFrame(() => explorerRef.current?.focus());
      return;
    }
    if (!explorer) return;
    if (explorer.isFocused()) {
      const target = explorerReturnFocusRef.current;
      explorerReturnFocusRef.current = null;
      if (target && document.body.contains(target)) target.focus();
      else (document.activeElement as HTMLElement | null)?.blur?.();
      return;
    }
    const active = document.activeElement;
    explorerReturnFocusRef.current =
      active instanceof HTMLElement && active !== document.body ? active : null;
    explorer.focus();
  }, [explorerRef, explorerReturnFocusRef, persistSidebarView, setSidebarOpen, sidebarOpen, sidebarView]);

  return {
    canvasFocused,
    toggleSidebar,
    toggleWorkspacesPanel,
    toggleCanvasFocus,
    cycleSidebarView,
    toggleExplorerFocus,
  };
}

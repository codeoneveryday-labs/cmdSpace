import { cn } from "@/lib/utils";
import type { RefObject, ReactNode } from "react";
import {
  SIDEBAR_MAX_WIDTH,
  WORKSPACES_PANEL_MAX_WIDTH,
} from "./constants";

export type AppChromeProps = {
  sidebarSplitRef: RefObject<HTMLDivElement | null>;
  workspaceRef: RefObject<HTMLDivElement | null>;
  workspacesPanel: ReactNode;
  workspaceSurface: ReactNode;
  workspaceSetup: ReactNode;
  workspaceLoading: ReactNode;
  bottomTerminal: ReactNode;
  sidebar: ReactNode;
  sidebarOpen: boolean;
  sidebarWidth: number;
  sidebarResizing: boolean;
  workspacesPanelOpen: boolean;
  workspacesPanelWidth: number;
  workspacesPanelCompact: boolean;
  workspacesPanelResizing: boolean;
  workspaceSetupOpen: boolean;
  onWorkspacesPanelResizeStart: React.PointerEventHandler<HTMLDivElement>;
  onWorkspacesPanelResizeKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
  onSidebarResizeStart: React.PointerEventHandler<HTMLDivElement>;
  onSidebarResizeKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
};

export function AppChrome({
  sidebarSplitRef,
  workspaceRef,
  workspacesPanel,
  workspaceSurface,
  workspaceSetup,
  workspaceLoading,
  bottomTerminal,
  sidebar,
  sidebarOpen,
  sidebarWidth,
  sidebarResizing,
  workspacesPanelOpen,
  workspacesPanelWidth,
  workspacesPanelCompact,
  workspacesPanelResizing,
  workspaceSetupOpen,
  onWorkspacesPanelResizeStart,
  onWorkspacesPanelResizeKeyDown,
  onSidebarResizeStart,
  onSidebarResizeKeyDown,
}: AppChromeProps) {
  return (
    <main className="relative min-h-0 flex-1 overflow-hidden">
        <div className="zoom-content absolute left-0 top-0 flex min-h-0">
          <div
            className={cn(
              "min-h-0 shrink-0 overflow-hidden",
              workspacesPanelResizing
                ? "transition-none"
                : "transition-[width] duration-150 ease-out",
            )}
            style={{ width: workspacesPanelOpen ? workspacesPanelWidth : 0 }}
          >
            <div className="h-full" style={{ width: workspacesPanelWidth }}>
              {workspacesPanel}
            </div>
          </div>
          <div
            role="separator"
            aria-label={
              workspacesPanelOpen
                ? "Resize workspaces panel"
                : "Open workspaces panel"
            }
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={WORKSPACES_PANEL_MAX_WIDTH}
            aria-valuenow={workspacesPanelOpen ? workspacesPanelWidth : 0}
            tabIndex={0}
            onPointerDown={onWorkspacesPanelResizeStart}
            onKeyDown={onWorkspacesPanelResizeKeyDown}
            className={cn(
              "relative z-50 -mx-2 flex w-4 shrink-0 cursor-col-resize touch-none select-none bg-transparent outline-none after:pointer-events-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border/70 focus-visible:ring-1 focus-visible:ring-ring",
              workspacesPanelCompact && "cursor-default focus-visible:ring-0",
            )}
          />
          <div
            ref={sidebarSplitRef}
            className={cn(
              "flex min-h-0 min-w-0 flex-1",
              (sidebarResizing || workspacesPanelResizing) &&
                "cursor-col-resize select-none",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex h-full min-h-0 flex-col">
                <div ref={workspaceRef} className="relative min-h-0 flex-1">
                  <div
                    className={cn(
                      "absolute inset-0",
                      workspaceSetupOpen && "invisible pointer-events-none",
                    )}
                    aria-hidden={workspaceSetupOpen}
                  >
                    {workspaceSurface}
                  </div>
                  {workspaceSetup}
                  {workspaceLoading}
                  {bottomTerminal}
                </div>
              </div>
            </div>
            <div
              role="separator"
              aria-label={sidebarOpen ? "Resize right sidebar" : "Open right sidebar"}
              aria-orientation="vertical"
              aria-valuemin={0}
              aria-valuemax={SIDEBAR_MAX_WIDTH}
              aria-valuenow={sidebarOpen ? sidebarWidth : 0}
              tabIndex={0}
              onPointerDown={onSidebarResizeStart}
              onKeyDown={onSidebarResizeKeyDown}
              className="relative z-50 -mx-2 flex w-4 shrink-0 cursor-col-resize touch-none select-none bg-transparent outline-none after:pointer-events-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border/70 focus-visible:ring-1 focus-visible:ring-ring"
            />
            <aside
              className={cn(
                "min-h-0 shrink-0 overflow-hidden",
                !sidebarOpen && "pointer-events-none",
                sidebarResizing
                  ? "transition-none"
                  : "transition-[width] duration-150 ease-out",
              )}
              style={{ width: sidebarOpen ? sidebarWidth : 0 }}
              aria-hidden={!sidebarOpen}
            >
              <div
                className="flex h-full min-h-0 shrink-0 flex-col bg-card"
                style={{ width: sidebarWidth }}
              >
                {sidebar}
              </div>
            </aside>
          </div>
        </div>
    </main>
  );
}

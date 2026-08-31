import { cn } from "@/lib/utils";
import type { RefObject } from "react";
import { WorkspaceTerminalList } from "./WorkspaceTerminalList";
import { WorkspaceRow } from "./WorkspaceRow";
import type { WorkspaceItem, WorkspaceTerminalItem } from "./WorkspacesPanel";

type DragVisual = {
  height: number;
  previewIndex: number;
} | null;

export function WorkspaceList({
  containerRef,
  compact,
  workspaces,
  renderedWorkspaces,
  activeWorkspaceId,
  expandedWorkspaceIds,
  dragVisual,
  placeholderIndex,
  createNotice,
  terminalDragVisual,
  onSelectTerminal,
  onSelectTab,
  onCreateTerminal,
  onCloseTerminal,
  onPointerDownTerminal,
  onSelectWorkspace,
  onToggleExpanded,
  onCloseWorkspace,
  onRenameWorkspace,
  onChangeWorkspaceColor,
  onDragStart,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  compact: boolean;
  workspaces: WorkspaceItem[];
  renderedWorkspaces: WorkspaceItem[];
  activeWorkspaceId: string | null;
  expandedWorkspaceIds: ReadonlySet<string>;
  dragVisual: DragVisual;
  placeholderIndex: number;
  createNotice: string | null;
  terminalDragVisual: { sourceId: number; targetId: number | null } | null;
  onSelectTerminal: (workspaceId: string, leafId: number) => void;
  onSelectTab?: (tabId: number) => void;
  onCreateTerminal: (initialCommand?: string) => boolean;
  onCloseTerminal: (terminal: WorkspaceTerminalItem) => void;
  onPointerDownTerminal?: (
    terminal: WorkspaceTerminalItem,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void;
  onSelectWorkspace: (workspaceId: string) => void;
  onToggleExpanded: (workspaceId: string) => void;
  onCloseWorkspace: (workspaceId: string) => void;
  onRenameWorkspace: (workspaceId: string, name: string) => void;
  onChangeWorkspaceColor: (workspaceId: string, accentColor: string) => void;
  onDragStart: (workspaceId: string, event: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <nav
      ref={containerRef}
      className={cn(
        "min-h-0 flex-1 space-y-1 overflow-y-auto py-2",
        compact ? "px-1.5" : "px-2",
      )}
    >
      {workspaces.length === 0 ? (
        <div
          className={cn(
            "text-xs leading-5 text-muted-foreground/70",
            compact ? "truncate px-2 py-3" : "px-2 py-3",
          )}
          title="No workspaces yet"
        >
          No workspaces yet
        </div>
      ) : (
        <>
          {renderedWorkspaces.flatMap((workspace, index) => {
            const placeholder =
              dragVisual !== null && index === placeholderIndex
                ? [
                    <div
                      key="drag-placeholder"
                      aria-hidden="true"
                      className="h-9 shrink-0 rounded-md border border-dashed border-blue-500/35 bg-blue-500/5 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)] transition-[height,opacity] duration-150"
                      style={{ height: dragVisual.height }}
                    />,
                  ]
                : [];

            return [
              ...placeholder,
              <div key={workspace.id} className="space-y-0.5">
                <WorkspaceRow
                  workspace={workspace}
                  active={workspace.id === activeWorkspaceId}
                  compact={compact}
                  expanded={expandedWorkspaceIds.has(workspace.id)}
                  canClose={workspaces.length > 1}
                  onSelect={() => onSelectWorkspace(workspace.id)}
                  onToggleExpanded={() => onToggleExpanded(workspace.id)}
                  onClose={() => onCloseWorkspace(workspace.id)}
                  onRename={(name) => onRenameWorkspace(workspace.id, name)}
                  onColorChange={(color) =>
                    onChangeWorkspaceColor(workspace.id, color)
                  }
                  onDragStart={onDragStart}
                />
                {expandedWorkspaceIds.has(workspace.id) ? (
                  <WorkspaceTerminalList
                    workspace={workspace}
                    terminals={workspace.terminals ?? []}
                    canCreate={workspace.id === activeWorkspaceId}
                    createNotice={
                      workspace.id === activeWorkspaceId ? createNotice : null
                    }
                    onCreateTerminal={onCreateTerminal}
                    onSelectTerminal={(leafId) =>
                      onSelectTerminal(workspace.id, leafId)
                    }
                    onSelectTab={onSelectTab}
                    onCloseTerminal={onCloseTerminal}
                    onPointerDownTerminal={
                      workspace.id === activeWorkspaceId
                        ? onPointerDownTerminal
                        : undefined
                    }
                    dragVisual={terminalDragVisual}
                  />
                ) : null}
              </div>,
            ];
          })}

          {dragVisual !== null &&
            placeholderIndex === renderedWorkspaces.length && (
              <div
                aria-hidden="true"
                className="h-9 shrink-0 rounded-md border border-dashed border-blue-500/35 bg-blue-500/5 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)] transition-[height,opacity] duration-150"
                style={{ height: dragVisual.height }}
              />
            )}
        </>
      )}
    </nav>
  );
}

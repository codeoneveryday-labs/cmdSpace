import { cn } from "@/lib/utils";
import type { RefObject } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown01Icon,
  DragDropVerticalIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { WorkspaceRow } from "./WorkspaceRow";
import {
  buildWorkspaceGroupMoveSteps,
  groupWorkspacesByDir,
} from "./lib/workspaceDirGroups";
import { useWorkspaceGroupReorderDrag } from "./lib/useWorkspaceGroupReorderDrag";
import type { WorkspaceItem } from "./WorkspacesPanel";

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
  dragVisual,
  placeholderIndex,
  onSelectWorkspace,
  onCloseWorkspace,
  onRenameWorkspace,
  onChangeWorkspaceColor,
  onDragStart,
  onReorderWorkspaces,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  compact: boolean;
  workspaces: WorkspaceItem[];
  renderedWorkspaces: WorkspaceItem[];
  activeWorkspaceId: string | null;
  dragVisual: DragVisual;
  placeholderIndex: number;
  onSelectWorkspace: (workspaceId: string) => void;
  onCloseWorkspace: (workspaceId: string) => void;
  onRenameWorkspace: (workspaceId: string, name: string) => void;
  onChangeWorkspaceColor: (workspaceId: string, accentColor: string) => void;
  onDragStart: (workspaceId: string, event: React.PointerEvent<HTMLDivElement>) => void;
  onReorderWorkspaces?: (
    draggedId: string,
    targetId: string,
    position: "before" | "after",
  ) => void;
}) {
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(
    () => new Set(),
  );
  const groupedWorkspaces = useMemo(
    () => groupWorkspacesByDir(renderedWorkspaces),
    [renderedWorkspaces],
  );
  const activeGroupId = groupedWorkspaces.find((group) =>
    group.workspaces.some((workspace) => workspace.id === activeWorkspaceId),
  )?.id ?? null;
  const reorderGroup = useMemo(
    () =>
      (draggedGroupId: string, targetGroupId: string, position: "before" | "after") => {
        const steps = buildWorkspaceGroupMoveSteps(
          renderedWorkspaces,
          draggedGroupId,
          targetGroupId,
          position,
        );
        steps.forEach((step) =>
          onReorderWorkspaces?.(step.draggedId, step.targetId, step.position),
        );
      },
    [onReorderWorkspaces, renderedWorkspaces],
  );
  const { groupDragVisual, onGroupDragStart } = useWorkspaceGroupReorderDrag({
    groups: groupedWorkspaces,
    containerRef,
    onReorderGroup: reorderGroup,
  });

  useEffect(() => {
    if (activeGroupId === null) return;
    setExpandedGroupIds((current) =>
      current.has(activeGroupId)
        ? current
        : new Set([...current, activeGroupId]),
    );
  }, [activeGroupId]);

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };
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
          {(groupDragVisual === null
            ? groupedWorkspaces
            : groupedWorkspaces.filter((group) => group.id !== groupDragVisual.id)
          ).flatMap((group, index) => {
            const groupExpanded = expandedGroupIds.has(group.id);
            const groupCount = group.workspaces.reduce(
              (total, item) => total + item.count,
              0,
            );
            const placeholder =
              groupDragVisual !== null && index === groupDragVisual.previewIndex
                ? [
                    <div
                      key="group-drag-placeholder"
                      aria-hidden="true"
                      className="h-8 shrink-0 rounded-md border border-dashed border-primary/40 bg-primary/5"
                      style={{ height: groupDragVisual.height }}
                    />,
                  ]
                : [];
            const header = (
              <div className="flex w-full items-center gap-1.5 px-1">
                <button
                  type="button"
                  aria-label={`Reorder ${group.label} directory`}
                  title={`Reorder ${group.label} directory`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    onGroupDragStart(group.id, event);
                  }}
                  onClick={(event) => event.stopPropagation()}
                  className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/60 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 active:cursor-grabbing"
                >
                  <HugeiconsIcon
                    icon={DragDropVerticalIcon}
                    size={13}
                    strokeWidth={2}
                  />
                </button>
                <button
                  type="button"
                  aria-expanded={groupExpanded}
                  onClick={() => toggleGroupExpanded(group.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left text-[11px] font-semibold text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                >
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    size={12}
                    strokeWidth={2}
                    className={cn(
                      "shrink-0 transition-transform",
                      !groupExpanded && "-rotate-90",
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate" title={group.id}>
                    {group.label}
                  </span>
                </button>
                <span className="shrink-0 rounded-full bg-muted px-1.5 py-px font-mono text-[10px] tabular-nums">
                  {groupCount}
                </span>
              </div>
            );
            if (!groupExpanded) {
              return [
                ...placeholder,
                <div
                  key={group.id}
                  data-workspace-group-id={group.id}
                  className={cn(
                    "space-y-0.5",
                    groupDragVisual?.id === group.id && "opacity-40",
                  )}
                >
                  {header}
                </div>,
              ];
            }
            return [
              ...placeholder,
              <div
                key={group.id}
                data-workspace-group-id={group.id}
                className={cn(
                  "space-y-0.5",
                  groupDragVisual?.id === group.id && "opacity-40",
                )}
              >
                {header}
                {group.workspaces.map((workspace) => {
                  const workspaceIndex = renderedWorkspaces.indexOf(workspace);
                  const workspacePlaceholder =
                    dragVisual !== null && workspaceIndex === placeholderIndex
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
                    ...workspacePlaceholder,
                    <div key={workspace.id} className="ml-2">
                      <WorkspaceRow
                        workspace={workspace}
                        active={workspace.id === activeWorkspaceId}
                        compact={compact}
                        canClose={workspaces.length > 1}
                        onSelect={() => onSelectWorkspace(workspace.id)}
                        onClose={() => onCloseWorkspace(workspace.id)}
                        onRename={(name) => onRenameWorkspace(workspace.id, name)}
                        onColorChange={(color) =>
                          onChangeWorkspaceColor(workspace.id, color)
                        }
                        onDragStart={onDragStart}
                      />
                    </div>,
                  ];
                })}
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

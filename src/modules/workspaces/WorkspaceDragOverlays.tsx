import {
  ComputerTerminal02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { createPortal } from "react-dom";
import type { MutableRefObject } from "react";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import { WorkspaceRow } from "./WorkspaceRow";
import type { WorkspaceItem, WorkspaceTerminalItem } from "./WorkspacesPanel";

export function WorkspaceDragOverlays({
  terminalDragRef,
  terminalDragVisual,
  draggedTerminal,
  pointerDragRef,
  dragVisual,
  draggedWorkspace,
  activeWorkspaceId,
  compact,
}: {
  terminalDragRef: MutableRefObject<{
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  } | null>;
  terminalDragVisual: {
    sourceId: number;
    targetId: number | null;
    x: number;
    y: number;
  } | null;
  draggedTerminal: WorkspaceTerminalItem | null;
  pointerDragRef: MutableRefObject<{
    width: number;
    offsetX: number;
    offsetY: number;
  } | null>;
  dragVisual: { height: number; x: number; y: number } | null;
  draggedWorkspace: WorkspaceItem | null;
  activeWorkspaceId: string | null;
  compact: boolean;
}) {
  return (
    <>
      {terminalDragVisual !== null
        ? createPortal(
            <div
              className="pointer-events-none fixed z-50 flex items-center gap-2 rounded-lg bg-popover px-2 py-2 text-sm text-popover-foreground opacity-90 shadow-xl ring-1 ring-border"
              style={{
                width: terminalDragRef.current?.width ?? 220,
                height: terminalDragRef.current?.height,
                left:
                  terminalDragVisual.x -
                  (terminalDragRef.current?.offsetX ?? 0),
                top:
                  terminalDragVisual.y -
                  (terminalDragRef.current?.offsetY ?? 0),
              }}
            >
              {draggedTerminal?.agent ? (
                <AgentCliIcon agent={draggedTerminal.agent} size="md" />
              ) : (
                <HugeiconsIcon
                  icon={ComputerTerminal02Icon}
                  size={16}
                  strokeWidth={1.8}
                />
              )}
              <span className="min-w-0 flex-1 truncate">
                {draggedTerminal?.label ?? "Terminal"}
              </span>
            </div>,
            document.body,
          )
        : null}

      {dragVisual !== null && draggedWorkspace && (
        <div
          className="pointer-events-none fixed z-50 opacity-80 shadow-2xl"
          style={{
            width: pointerDragRef.current?.width ?? 220,
            height: dragVisual.height,
            left: dragVisual.x - (pointerDragRef.current?.offsetX ?? 0),
            top: dragVisual.y - (pointerDragRef.current?.offsetY ?? 0),
          }}
        >
          <WorkspaceRow
            workspace={draggedWorkspace}
            active={draggedWorkspace.id === activeWorkspaceId}
            compact={compact}
            expanded={false}
            canClose={false}
            onSelect={() => {}}
            onToggleExpanded={() => {}}
            onClose={() => {}}
            onRename={() => {}}
            onColorChange={() => {}}
            isDragging={true}
          />
        </div>
      )}
    </>
  );
}

import type { MutableRefObject } from "react";
import { WorkspaceRow } from "./WorkspaceRow";
import type { WorkspaceItem } from "./WorkspacesPanel";

export function WorkspaceDragOverlays({
  pointerDragRef,
  dragVisual,
  draggedWorkspace,
  activeWorkspaceId,
  compact,
}: {
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
            canClose={false}
            onSelect={() => {}}
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

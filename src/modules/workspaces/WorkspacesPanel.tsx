import { useRef } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { AgentDisplayState } from "@/modules/terminal/AgentStateDot";
import { WorkspacePanelHeader } from "./WorkspacePanelHeader";
import { WorkspaceList } from "./WorkspaceList";
import { WorkspaceDragOverlays } from "./WorkspaceDragOverlays";
import { useWorkspaceReorderDrag } from "./lib/useWorkspaceReorderDrag";
export { WorkspaceSetupView } from "./WorkspaceSetupView";
export {
  DEFAULT_WORKSPACE_ACCENT_COLOR,
  WORKSPACE_ACCENT_COLORS,
  normalizeWorkspaceAccentColor,
} from "./WorkspaceRowPrimitives";

export type WorkspaceItem = {
  id: string;
  name: string;
  count: number;
  accentColor: string;
  workspaceMode?: WorkspaceMode;
  workingFolder?: string | null;
  updatedAt?: number;
  responding?: boolean;
  state?: AgentDisplayState;
  terminals?: WorkspaceTerminalItem[];
};

export type WorkspaceMode = "standard" | "canvas" | "agent";
export type WorkspaceTerminalItem = {
  leafId: number;
  cwd?: string | null;
  tabId?: number;
  label: string;
  onClose?: () => void;
  agent?: CliAgent;
  active: boolean;
  responding: boolean;
  completed: boolean;
  state?: AgentDisplayState;
};

type Props = {
  activeWorkspaceId: string | null;
  compact?: boolean;
  workspaces: WorkspaceItem[];
  onSelectWorkspace: (workspaceId: string) => void;
  onCloseWorkspace: (workspaceId: string) => void;
  onRenameWorkspace: (workspaceId: string, name: string) => void;
  onChangeWorkspaceColor: (workspaceId: string, accentColor: string) => void;
  onStartWorkspaceSetup: () => void;
  onImportSession: () => void;
  onReorderWorkspaces?: (
    draggedId: string,
    targetId: string,
    position: "before" | "after",
  ) => void;
};

export function WorkspacesPanel({
  activeWorkspaceId,
  compact = false,
  workspaces,
  onSelectWorkspace,
  onCloseWorkspace,
  onRenameWorkspace,
  onChangeWorkspaceColor,
  onStartWorkspaceSetup,
  onImportSession,
  onReorderWorkspaces,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    pointerDragRef,
    dragVisual,
    onDragStart,
  } = useWorkspaceReorderDrag({
    workspaces,
    containerRef,
    onReorderWorkspaces,
  });

  const draggedWorkspace =
    dragVisual === null
      ? null
      : (workspaces.find((w) => w.id === dragVisual.id) ?? null);

  const renderedWorkspaces =
    dragVisual === null
      ? workspaces
      : workspaces.filter((w) => w.id !== dragVisual.id);

  const placeholderIndex =
    dragVisual === null
      ? -1
      : Math.min(
          Math.max(dragVisual.previewIndex, 0),
          renderedWorkspaces.length,
        );

  return (
    <>
      <aside className="flex h-full min-h-0 flex-col overflow-hidden bg-card">
        <WorkspacePanelHeader
          compact={compact}
          activeWorkspaceId={activeWorkspaceId}
          onStartWorkspaceSetup={onStartWorkspaceSetup}
          onImportSession={onImportSession}
        />

        <WorkspaceList
          containerRef={containerRef}
          compact={compact}
          workspaces={workspaces}
          renderedWorkspaces={renderedWorkspaces}
          activeWorkspaceId={activeWorkspaceId}
          dragVisual={dragVisual}
          placeholderIndex={placeholderIndex}
          onSelectWorkspace={onSelectWorkspace}
          onCloseWorkspace={onCloseWorkspace}
          onRenameWorkspace={onRenameWorkspace}
          onChangeWorkspaceColor={onChangeWorkspaceColor}
          onDragStart={onDragStart}
          onReorderWorkspaces={onReorderWorkspaces}
        />
      </aside>

      <WorkspaceDragOverlays
        pointerDragRef={pointerDragRef}
        dragVisual={dragVisual}
        draggedWorkspace={draggedWorkspace}
        activeWorkspaceId={activeWorkspaceId}
        compact={compact}
      />
    </>
  );
}

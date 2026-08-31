import { useCallback, useEffect, useRef, useState } from "react";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { AgentDisplayState } from "@/modules/terminal/AgentStateDot";
import { WorkspacePanelHeader } from "./WorkspacePanelHeader";
import { WorkspaceList } from "./WorkspaceList";
import { WorkspaceDragOverlays } from "./WorkspaceDragOverlays";
import { useWorkspaceTerminalDrag } from "./lib/useWorkspaceTerminalDrag";
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
  activeWorkspaceTerminals: WorkspaceTerminalItem[];
  onSelectTerminal: (workspaceId: string, leafId: number) => void;
  onSelectTab?: (tabId: number) => void;
  onSwapTerminals: (sourceId: number, targetId: number) => void;
  onCreateTerminal: (initialCommand?: string) => boolean;
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
  activeWorkspaceTerminals,
  onSelectTerminal,
  onSelectTab,
  onSwapTerminals,
  onCreateTerminal,
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
  const [createNotice, setCreateNotice] = useState<string | null>(null);
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<Set<string>>(
    () => new Set(activeWorkspaceId ? [activeWorkspaceId] : []),
  );
  const handleCreateTerminal = useCallback(
    (initialCommand?: string) => {
      const created = onCreateTerminal(initialCommand);
      setCreateNotice(
        created
          ? null
          : "Workspace terminal limit reached. Close a terminal before adding another.",
      );
      return created;
    },
    [onCreateTerminal],
  );
  const toggleWorkspaceExpanded = useCallback((workspaceId: string) => {
    setExpandedWorkspaceIds((current) => {
      const next = new Set(current);
      if (next.has(workspaceId)) next.delete(workspaceId);
      else next.add(workspaceId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (activeWorkspaceId === null) return;
    setExpandedWorkspaceIds((current) => {
      if (current.has(activeWorkspaceId)) return current;
      return new Set([...current, activeWorkspaceId]);
    });
  }, [activeWorkspaceId]);

  const {
    pointerDragRef,
    dragVisual,
    onDragStart,
  } = useWorkspaceReorderDrag({
    workspaces,
    containerRef,
    onReorderWorkspaces,
  });

  const {
    terminalDragRef,
    terminalDragVisual,
    startTerminalDrag,
  } = useWorkspaceTerminalDrag({
    activeWorkspaceTerminals,
    onSwapTerminals,
  });

  const draggedTerminal =
    terminalDragVisual === null
      ? null
      : activeWorkspaceTerminals.find(
          (terminal) => terminal.leafId === terminalDragVisual.sourceId,
        ) ?? null;

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
          expandedWorkspaceIds={expandedWorkspaceIds}
          dragVisual={dragVisual}
          placeholderIndex={placeholderIndex}
          createNotice={createNotice}
          terminalDragVisual={terminalDragVisual}
          onSelectTerminal={onSelectTerminal}
          onSelectTab={onSelectTab}
          onCreateTerminal={handleCreateTerminal}
          onCloseTerminal={(terminal) => terminal.onClose?.()}
          onPointerDownTerminal={startTerminalDrag}
          onSelectWorkspace={onSelectWorkspace}
          onToggleExpanded={toggleWorkspaceExpanded}
          onCloseWorkspace={onCloseWorkspace}
          onRenameWorkspace={onRenameWorkspace}
          onChangeWorkspaceColor={onChangeWorkspaceColor}
          onDragStart={onDragStart}
        />
      </aside>

      <WorkspaceDragOverlays
        terminalDragRef={terminalDragRef}
        terminalDragVisual={terminalDragVisual}
        draggedTerminal={draggedTerminal}
        pointerDragRef={pointerDragRef}
        dragVisual={dragVisual}
        draggedWorkspace={draggedWorkspace}
        activeWorkspaceId={activeWorkspaceId}
        compact={compact}
      />
    </>
  );
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Add01Icon,
  AiChat01Icon,
  ArrowDown01Icon,
  ArrowLeft02Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  CanvasIcon,
  ComputerTerminal02Icon,
  Folder01Icon,
  Download01Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  CLI_AGENT_DEFINITIONS,
  getEnabledCliAgentDefinitions,
  type CliAgent,
} from "@/modules/terminal/lib/cliAgents";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import { AgentStateDot, type AgentDisplayState } from "@/modules/terminal/AgentStateDot";
import { TerminalAgentSwitcher } from "@/modules/terminal/TerminalAgentSwitcher";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { setAgentLaunchCommands } from "@/modules/settings/store";
import {
  isolatedAgentCommand,
  worktreeGroup,
} from "@/modules/ai/lib/agentWorktree";
import { resolveAgentChatWorkspaceAgents } from "@/modules/ai/lib/agentChatProviders";
import type { AgentChatHistoryAttachment } from "@/modules/ai/lib/agentChatTimeline";
import { ImportSessionDialog } from "./ImportSessionDialog";
import {
  buildSessionResumeCommand,
  regularTerminalCount,
  type ImportableAgentSession,
} from "./lib/importSessions";

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

const TERMINAL_COUNTS = [1, 2, 4, 6, 8, 10, 12] as const;
const WORKSPACE_SETUP_PRESETS: Array<{
  name: string;
  description: string;
  count: (typeof TERMINAL_COUNTS)[number];
}> = [
  { name: "Focus", description: "Single terminal", count: 1 },
  { name: "Pair", description: "Side by side", count: 2 },
  { name: "Quad", description: "2 x 2 grid", count: 4 },
  { name: "Builder", description: "2 x 3 grid", count: 6 },
  { name: "Review", description: "2 x 4 grid", count: 8 },
  { name: "Lab", description: "3 x 4 grid", count: 12 },
];
const AGENT_CLI_OPTIONS = CLI_AGENT_DEFINITIONS;
export const WORKSPACE_ACCENT_COLORS = [
  "#10B981",
  "#14B8A6",
  "#0EA5E9",
  "#6366F1",
  "#8B5CF6",
  "#D946EF",
  "#F43F5E",
  "#F97316",
  "#F59E0B",
  "#65A30D",
] as const;
export const DEFAULT_WORKSPACE_ACCENT_COLOR = WORKSPACE_ACCENT_COLORS[0];

function WorkspaceModeIcon({ workspace }: { workspace: WorkspaceItem }) {
  const canvas = workspace.workspaceMode === "canvas";
  const agent = workspace.workspaceMode === "agent";
  const label = canvas
    ? "Canvas workspace"
    : agent
      ? "Agent chat workspace"
      : "Standard terminal workspace";

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="flex size-4 shrink-0 items-center justify-center text-muted-foreground/80"
    >
      <HugeiconsIcon
        icon={canvas ? CanvasIcon : agent ? AiChat01Icon : ComputerTerminal02Icon}
        size={13}
        strokeWidth={1.9}
      />
    </span>
  );
}

export function normalizeWorkspaceAccentColor(
  color: string | null | undefined,
  fallback: string = DEFAULT_WORKSPACE_ACCENT_COLOR,
): string {
  return WORKSPACE_ACCENT_COLORS.includes(
    color as (typeof WORKSPACE_ACCENT_COLORS)[number],
  )
    ? color!
    : fallback;
}

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
  const terminalDragRef = useRef<{
    sourceId: number;
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    dragging: boolean;
    targetId: number | null;
  } | null>(null);
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

  const [terminalDragVisual, setTerminalDragVisual] = useState<{
    sourceId: number;
    targetId: number | null;
    x: number;
    y: number;
  } | null>(null);
  const pointerDragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    dragging: boolean;
    previewIndex: number;
  } | null>(null);

  const [dragVisual, setDragVisual] = useState<{
    id: string;
    height: number;
    x: number;
    y: number;
    previewIndex: number;
  } | null>(null);

  const draggedTerminal =
    terminalDragVisual === null
      ? null
      : activeWorkspaceTerminals.find(
          (terminal) => terminal.leafId === terminalDragVisual.sourceId,
        ) ?? null;

  const startTerminalDrag = useCallback(
    (terminal: WorkspaceTerminalItem, event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || activeWorkspaceTerminals.length < 2) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      terminalDragRef.current = {
        sourceId: terminal.leafId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: event.clientX - bounds.left,
        offsetY: event.clientY - bounds.top,
        width: bounds.width,
        height: bounds.height,
        dragging: false,
        targetId: null,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
    },
    [activeWorkspaceTerminals.length],
  );

  useEffect(() => {
    const clearTerminalDrag = () => {
      terminalDragRef.current = null;
      setTerminalDragVisual(null);
    };

    const targetAtPoint = (clientX: number, clientY: number) => {
      const drag = terminalDragRef.current;
      if (!drag) return null;
      const row = document
        .elementsFromPoint(clientX, clientY)
        .map((element) =>
          element.closest<HTMLElement>("[data-terminal-leaf-id]"),
        )
        .find((element): element is HTMLElement => element !== null);
      const candidate = row ? Number(row.dataset.terminalLeafId) : null;
      return candidate !== null &&
        candidate !== drag.sourceId &&
        activeWorkspaceTerminals.some((terminal) => terminal.leafId === candidate)
        ? candidate
        : null;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const drag = terminalDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const moved =
        Math.abs(event.clientX - drag.startX) > 4 ||
        Math.abs(event.clientY - drag.startY) > 4;
      if (!drag.dragging && !moved) return;
      event.preventDefault();
      const targetId = targetAtPoint(event.clientX, event.clientY);
      terminalDragRef.current = { ...drag, dragging: true, targetId };
      setTerminalDragVisual({
        sourceId: drag.sourceId,
        targetId,
        x: event.clientX,
        y: event.clientY,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = terminalDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const targetId = targetAtPoint(event.clientX, event.clientY);
      if (drag.dragging && targetId !== null) {
        onSwapTerminals(drag.sourceId, targetId);
      }
      clearTerminalDrag();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !terminalDragRef.current) return;
      event.preventDefault();
      clearTerminalDrag();
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", clearTerminalDrag);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", clearTerminalDrag);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", clearTerminalDrag);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", clearTerminalDrag);
    };
  }, [activeWorkspaceTerminals, onSwapTerminals]);

  const onDragStart = useCallback(
    (id: string, e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      pointerDragRef.current = {
        id,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        width: rect.width,
        height: rect.height,
        dragging: false,
        previewIndex: workspaces.findIndex((w) => w.id === id),
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [workspaces],
  );

  useEffect(() => {
    const previewIndexForPointer = (
      drag: typeof pointerDragRef.current,
      clientY: number,
    ) => {
      if (!drag) return 0;
      const rowCenterY = clientY - drag.offsetY + drag.height / 2;
      const siblings = workspaces.filter((w) => w.id !== drag.id);

      for (let index = 0; index < siblings.length; index += 1) {
        const sibling = containerRef.current?.querySelector<HTMLElement>(
          `[data-workspace-id="${siblings[index].id}"]`,
        );
        if (!sibling) continue;
        const bounds = sibling.getBoundingClientRect();
        if (rowCenterY < bounds.top + bounds.height / 2) return index;
      }
      return siblings.length;
    };

    const onPointerMove = (e: PointerEvent) => {
      const drag = pointerDragRef.current;
      if (!drag) return;

      const moved =
        Math.abs(e.clientX - drag.startX) > 4 ||
        Math.abs(e.clientY - drag.startY) > 4;

      if (!drag.dragging && !moved) return;

      const dragging = drag.dragging || moved;
      const nextDrag = {
        ...drag,
        dragging,
        previewIndex: previewIndexForPointer(drag, e.clientY),
      };

      pointerDragRef.current = nextDrag;
      setDragVisual({
        id: nextDrag.id,
        height: nextDrag.height,
        x: e.clientX,
        y: e.clientY,
        previewIndex: nextDrag.previewIndex,
      });
    };

    const onPointerUp = () => {
      const drag = pointerDragRef.current;
      if (!drag) return;

      if (drag.dragging && onReorderWorkspaces) {
        const siblings = workspaces.filter((w) => w.id !== drag.id);
        const previewIndex = drag.previewIndex;

        if (previewIndex >= siblings.length) {
          const lastSibling = siblings[siblings.length - 1];
          if (lastSibling) {
            onReorderWorkspaces(drag.id, lastSibling.id, "after");
          }
        } else {
          const targetSibling = siblings[previewIndex];
          if (targetSibling) {
            onReorderWorkspaces(drag.id, targetSibling.id, "before");
          }
        }
      }

      pointerDragRef.current = null;
      setDragVisual(null);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [onReorderWorkspaces, workspaces]);

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
        <header
          className={cn(
            "flex h-10 shrink-0 items-center border-b border-border/60",
            compact ? "gap-1 px-2" : "gap-1 px-3",
          )}
        >
          {compact ? (
            <div className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              WORKSPACES
            </div>
          ) : (
            <div className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              WORKSPACES
            </div>
          )}
          <button
            type="button"
            onClick={onStartWorkspaceSetup}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label="New workspace"
            title="New workspace"
          >
            <HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={2} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label="Workspace menu"
                title="Workspace menu"
              >
                <HugeiconsIcon icon={ArrowDown01Icon} size={14} strokeWidth={2} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44 rounded-xl p-1">
              <DropdownMenuItem onSelect={onStartWorkspaceSetup} className="gap-2 rounded-md py-1.5 text-sm">
                <HugeiconsIcon icon={Add01Icon} size={15} strokeWidth={1.8} />
                New workspace
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onImportSession}
                disabled={activeWorkspaceId === null}
                className="gap-2 rounded-md py-1.5 text-sm"
              >
                <HugeiconsIcon icon={Download01Icon} size={15} strokeWidth={1.8} />
                Import agent session
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

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
                          className={cn(
                            "shrink-0 rounded-md border border-dashed border-blue-500/35 bg-blue-500/5 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)] transition-[height,opacity] duration-150",
                            "h-9",
                          )}
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
                      onToggleExpanded={() => toggleWorkspaceExpanded(workspace.id)}
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
                        onCreateTerminal={handleCreateTerminal}
                        onSelectTerminal={(leafId) =>
                          onSelectTerminal(workspace.id, leafId)
                        }
                        onSelectTab={onSelectTab}
                        onCloseTerminal={(terminal) => terminal.onClose?.()}
                        onPointerDownTerminal={
                          workspace.id === activeWorkspaceId
                            ? startTerminalDrag
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
                    className={cn(
                      "shrink-0 rounded-md border border-dashed border-blue-500/35 bg-blue-500/5 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.12)] transition-[height,opacity] duration-150",
                      "h-9",
                    )}
                    style={{ height: dragVisual.height }}
                  />
                )}
            </>
          )}
        </nav>
      </aside>

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

function WorkspaceTerminalList({
  workspace,
  terminals,
  canCreate,
  createNotice,
  onCreateTerminal,
  onSelectTerminal,
  onSelectTab,
  onCloseTerminal,
  onPointerDownTerminal,
  dragVisual,
}: {
  workspace: WorkspaceItem;
  terminals: WorkspaceTerminalItem[];
  canCreate: boolean;
  createNotice: string | null;
  onCreateTerminal: (initialCommand?: string) => boolean;
  onSelectTerminal: (leafId: number) => void;
  onSelectTab?: (tabId: number) => void;
  onCloseTerminal: (terminal: WorkspaceTerminalItem) => void;
  onPointerDownTerminal?: (
    terminal: WorkspaceTerminalItem,
    event: React.PointerEvent<HTMLDivElement>,
  ) => void;
  dragVisual: { sourceId: number; targetId: number | null } | null;
}) {
  return (
    <div
      className="ml-3 space-y-0.5 border-l border-border/60 pl-2"
      aria-label={`${workspace.name} terminals`}
    >
      {terminals.map((terminal) => (
        <div
          key={terminal.leafId}
          data-terminal-leaf-id={terminal.leafId}
          onPointerDown={(event) => onPointerDownTerminal?.(terminal, event)}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("button")) return;
            if (terminal.tabId !== undefined) onSelectTab?.(terminal.tabId);
            else onSelectTerminal(terminal.leafId);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            if (terminal.tabId !== undefined) onSelectTab?.(terminal.tabId);
            else onSelectTerminal(terminal.leafId);
          }}
          role="button"
          tabIndex={0}
          className={cn(
            "group flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
            terminal.active
              ? "bg-muted text-foreground dark:bg-zinc-800"
              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            dragVisual?.sourceId === terminal.leafId && "opacity-40",
            dragVisual?.targetId === terminal.leafId &&
              "bg-primary/10 ring-1 ring-inset ring-primary/55",
          )}
          title={`Focus ${terminal.label}`}
        >
          {terminal.agent ? (
            <AgentCliIcon agent={terminal.agent} />
          ) : (
            <HugeiconsIcon
              icon={ComputerTerminal02Icon}
              size={15}
              strokeWidth={1.8}
            />
          )}
          {terminal.state ? <AgentStateDot state={terminal.state} /> : null}
          <span className="min-w-0 flex-1 truncate">{terminal.label}</span>
          {terminal.onClose ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCloseTerminal(terminal);
              }}
              className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 opacity-0 transition-[opacity,background-color,color] group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
              aria-label={`Close ${terminal.label}`}
              title={`Close ${terminal.label}`}
            >
              <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2} />
            </button>
          ) : null}
        </div>
      ))}
      {terminals.length === 0 ? (
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          No terminals open
        </div>
      ) : null}
      {canCreate ? (
        <TerminalAgentSwitcher
          currentAgent={null}
          allowSameSelection
          onSelect={(_agent, command) => onCreateTerminal(command ?? undefined)}
          trigger={
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={`Create terminal in ${workspace.name}`}
              title="Create terminal in workspace"
            >
              <HugeiconsIcon icon={Add01Icon} size={14} strokeWidth={2} />
              New terminal
            </button>
          }
        />
      ) : null}
      {createNotice ? (
        <div
          role="alert"
          className="rounded-md bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300"
        >
          {createNotice}
        </div>
      ) : null}
    </div>
  );
}

function WorkspaceRow({
  workspace,
  active,
  compact = false,
  expanded,
  canClose,
  onSelect,
  onToggleExpanded,
  onClose,
  onRename,
  onColorChange,
  onDragStart,
  isDragging = false,
}: {
  workspace: WorkspaceItem;
  active: boolean;
  compact?: boolean;
  expanded: boolean;
  canClose: boolean;
  onSelect: () => void;
  onToggleExpanded: () => void;
  onClose: () => void;
  onRename: (name: string) => void;
  onColorChange: (accentColor: string) => void;
  onDragStart?: (id: string, e: React.PointerEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(workspace.name);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const accentColor = normalizeWorkspaceAccentColor(workspace.accentColor);
  const accentBg = colorWithAlpha(accentColor, 0.1);
  const accentBorder = colorWithAlpha(accentColor, 0.38);
  const accentGlow = colorWithAlpha(accentColor, 0.26);
  const canExpand = true;
  const toggleLabel = expanded
    ? `Hide terminals for ${workspace.name}`
    : `Show terminals for ${workspace.name}`;
  const activeRowStyle =
    active || isDragging
      ? {
          touchAction: "none",
          borderColor: accentBorder,
          backgroundColor: active
            ? accentBg
            : colorWithAlpha(accentColor, 0.14),
          boxShadow: `inset 0 0 0 1px ${colorWithAlpha(accentColor, 0.16)}, 0 0 0 1px ${colorWithAlpha(accentColor, 0.1)}`,
        }
      : { touchAction: "none" };

  useEffect(() => {
    if (!renaming) setDraftName(workspace.name);
  }, [renaming, workspace.name]);

  useEffect(() => {
    if (!renaming) return;
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [renaming]);

  useEffect(() => {
    if (compact && renaming) setRenaming(false);
  }, [compact, renaming]);

  const commitRename = () => {
    const nextName = draftName.trim();
    setRenaming(false);
    if (nextName.length > 0 && nextName !== workspace.name) {
      onRename(nextName);
    } else {
      setDraftName(workspace.name);
    }
  };

  const handleRowSelect = (event: React.MouseEvent<HTMLDivElement>) => {
    if (renaming) return;
    const target = event.target as HTMLElement;
    if (target.closest("button")) return;
    if (target.closest("input")) return;
    onSelect();
  };

  const colorPicker = (
    <WorkspaceColorPicker
      workspaceName={workspace.name}
      accentColor={accentColor}
      onColorChange={onColorChange}
    />
  );

  if (compact) {
    return (
      <div
        data-workspace-id={workspace.id}
        onClick={handleRowSelect}
        onPointerDown={(e) => {
          if (onDragStart) {
            if (renaming || e.button !== 0) return;
            const target = e.target as HTMLElement;
            if (target.closest("button") && !target.closest("button.min-w-0")) {
              return;
            }
            onDragStart(workspace.id, e);
          }
        }}
        style={activeRowStyle}
        className={cn(
          "group flex h-9 w-full items-center gap-1.5 rounded-md border px-2 text-left outline-none transition-colors select-none",
          active
            ? "text-foreground"
            : "border-transparent text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
          isDragging && "scale-[1.02] cursor-grabbing opacity-80 shadow-lg",
        )}
        title={workspace.name}
      >
        {canExpand ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleExpanded();
            }}
            className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              size={13}
              strokeWidth={2}
              className={cn("transition-transform duration-150", !expanded && "-rotate-90")}
            />
          </button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden="true" />
        )}
        {colorPicker}
        <WorkspaceModeIcon workspace={workspace} />
        {workspace.state ? <AgentStateDot state={workspace.state} /> : null}
        <button
          type="button"
          disabled={!canClose}
          onClick={onSelect}
          aria-current={active ? "page" : undefined}
          aria-label={workspace.name}
          title={workspace.name}
          className="min-w-0 flex-1 truncate text-left text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {workspace.name}
        </button>
        <span
          className={cn(
            "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums",
            active ? "shadow-sm" : "",
          )}
          style={{
            backgroundColor: colorWithAlpha(accentColor, active ? 0.16 : 0.12),
            color: accentColor,
            boxShadow: active ? `0 0 14px ${accentGlow}` : undefined,
          }}
        >
          {workspace.count}
        </span>
      </div>
    );
  }

  return (
    <div
      data-workspace-id={workspace.id}
      onClick={handleRowSelect}
      onPointerDown={(e) => {
        if (onDragStart) {
          if (renaming || e.button !== 0) return;
          const target = e.target as HTMLElement;
          if (target.closest("button") && !target.closest("button.min-w-0")) {
            return;
          }
          if (target.closest("input")) return;
          onDragStart(workspace.id, e);
        }
      }}
      style={activeRowStyle}
      className={cn(
        "group flex h-9 w-full items-center gap-2 rounded-md border px-2 text-left outline-none transition-colors select-none",
        active
          ? "text-foreground"
          : "border-transparent text-muted-foreground hover:bg-foreground/[0.045] hover:text-foreground",
        isDragging && "scale-[1.02] cursor-grabbing opacity-80 shadow-lg",
      )}
    >
      {canExpand ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpanded();
          }}
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-foreground/[0.08] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={13}
            strokeWidth={2}
            className={cn("transition-transform duration-150", !expanded && "-rotate-90")}
          />
        </button>
      ) : (
        <span className="size-5 shrink-0" aria-hidden="true" />
      )}
      {colorPicker}
      <WorkspaceModeIcon workspace={workspace} />
      {workspace.state ? <AgentStateDot state={workspace.state} /> : null}
      {renaming ? (
        <Input
          ref={inputRef}
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitRename();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraftName(workspace.name);
              setRenaming(false);
            }
          }}
          className="h-7 min-w-0 flex-1 rounded-sm border-blue-400/45 bg-background/80 px-1.5 text-sm font-medium text-foreground shadow-none focus-visible:ring-2 focus-visible:ring-blue-400/35"
          aria-label={`Rename ${workspace.name}`}
        />
      ) : (
        <button
          type="button"
          onClick={onSelect}
          onDoubleClick={() => setRenaming(true)}
          aria-current={active ? "page" : undefined}
          className="min-w-0 flex-1 truncate text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {workspace.name}
        </button>
      )}
      <span
        className={cn(
          "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums",
          active ? "shadow-sm" : "",
        )}
        style={{
          backgroundColor: colorWithAlpha(accentColor, active ? 0.16 : 0.12),
          color: accentColor,
          boxShadow: active ? `0 0 14px ${accentGlow}` : undefined,
        }}
      >
        {workspace.count}
      </span>
      {active ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex size-6 shrink-0 items-center justify-center rounded-md transition-colors group-hover:bg-foreground/[0.06] disabled:pointer-events-none disabled:opacity-30"
          style={{ color: accentColor }}
          aria-label={`Delete ${workspace.name}`}
          title={canClose ? `Delete ${workspace.name}` : "At least one workspace is required"}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2} />
        </button>
      ) : (
        <button
          type="button"
          disabled={!canClose}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-30"
          aria-label={`Delete ${workspace.name}`}
          title={canClose ? `Delete ${workspace.name}` : "At least one workspace is required"}
        >
          <HugeiconsIcon icon={Cancel01Icon} size={13} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

function WorkspaceColorPicker({
  workspaceName,
  accentColor,
  onColorChange,
}: {
  workspaceName: string;
  accentColor: string;
  onColorChange: (accentColor: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex size-5 shrink-0 items-center justify-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={`Change color for ${workspaceName}`}
          title={`Change color for ${workspaceName}`}
        >
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full ring-1 ring-black/5"
            style={{
              backgroundColor: accentColor,
              boxShadow: `0 0 12px ${colorWithAlpha(accentColor, 0.5)}`,
            }}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={6}
        className="w-auto gap-1 rounded-xl p-1.5"
      >
        <div
          className="grid grid-cols-5 gap-1"
          role="listbox"
          aria-label="Workspace colors"
        >
          {WORKSPACE_ACCENT_COLORS.map((color) => {
            const selected = color === accentColor;
            return (
              <button
                key={color}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={`Use workspace color ${color}`}
                onClick={() => {
                  onColorChange(color);
                  setOpen(false);
                }}
                className={cn(
                  "grid size-6 place-items-center rounded-full shadow-sm ring-1 ring-black/10 outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-primary/40",
                  selected && "ring-foreground/55",
                )}
                style={{ backgroundColor: color }}
              >
                {selected ? (
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    size={13}
                    strokeWidth={2.4}
                    className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function colorWithAlpha(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveFolderCommand(
  command: string,
  currentFolder: string,
): string | null {
  const match = /^cd(?:\s+(.+))?$/i.exec(command.trim());
  if (!match) return null;
  const target = stripPathQuotes((match[1] ?? "~").trim()) || "~";
  return resolveWorkspacePath(target, currentFolder.trim());
}

function stripPathQuotes(value: string): string {
  const first = value[0];
  const last = value[value.length - 1];
  if ((first === '"' || first === "'") && first === last) {
    return value.slice(1, -1);
  }
  return value;
}

function resolveWorkspacePath(target: string, currentFolder: string): string {
  const home = inferHomePath(currentFolder);
  const expandedTarget =
    target === "~" || target.startsWith("~/") || target.startsWith("~\\")
      ? `${home ?? ""}${target.slice(1)}`
      : target;
  const joinedTarget =
    isAbsoluteWorkspacePath(expandedTarget) || !currentFolder
      ? expandedTarget
      : `${currentFolder.replace(/[\\/]+$/, "")}/${expandedTarget}`;
  return normalizeWorkspacePath(joinedTarget);
}

function inferHomePath(currentFolder: string): string | null {
  const normalized = currentFolder.replace(/\\/g, "/");
  const unixMatch = /^\/(Users|home)\/[^/]+/i.exec(normalized);
  if (unixMatch) return unixMatch[0];
  const windowsMatch = /^[A-Za-z]:\/Users\/[^/]+/i.exec(normalized);
  return windowsMatch?.[0] ?? null;
}

function isAbsoluteWorkspacePath(path: string): boolean {
  return (
    path.startsWith("/") ||
    path.startsWith("\\\\") ||
    /^[A-Za-z]:[\\/]/.test(path)
  );
}

function normalizeWorkspacePath(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const drive = /^[A-Za-z]:/.exec(normalized)?.[0] ?? "";
  const absolute = normalized.startsWith("/") || Boolean(drive);
  const rest = drive ? normalized.slice(drive.length) : normalized;
  const parts: string[] = [];
  for (const part of rest.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length > 0) parts.pop();
      continue;
    }
    parts.push(part);
  }
  const joined = parts.join("/");
  if (drive) return joined ? `${drive}/${joined}` : `${drive}/`;
  if (absolute) return joined ? `/${joined}` : "/";
  return joined || ".";
}

function recentWorkspaceFolderLabel(path: string): string {
  const normalized = normalizeWorkspacePath(path);
  const home = inferHomePath(normalized);
  if (home && (normalized === home || normalized.startsWith(`${home}/`))) {
    return `~${normalized.slice(home.length)}`;
  }
  return normalized;
}

function coerceTerminalCount(count: number): (typeof TERMINAL_COUNTS)[number] {
  return TERMINAL_COUNTS.includes(count as (typeof TERMINAL_COUNTS)[number])
    ? (count as (typeof TERMINAL_COUNTS)[number])
    : 1;
}

function buildAgentCliCommand(
  command: string,
  launch?: string,
): string {
  const trimmed = command.trim();
  if (!trimmed) return "";
  return launch?.trim() || trimmed;
}

function agentCommandPlan(
  agentCounts: Record<string, number>,
  customCommand: string,
  effectiveCommands: Record<string, string> = {},
): string[] {
  const commands: string[] = [];
  for (const agent of AGENT_CLI_OPTIONS) {
    const count = agentCounts[agent.id] ?? 0;
    const command = effectiveCommands[agent.id] || agent.launch || agent.command;
    for (let index = 0; index < count; index += 1) {
      commands.push(command);
    }
  }
  const customCount = agentCounts.custom ?? 0;
  const custom = buildAgentCliCommand(customCommand);
  if (custom) {
    for (let index = 0; index < customCount; index += 1) {
      commands.push(custom);
    }
  }
  return commands;
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function WorkspaceSetupView({
  workingFolder,
  suggestedWorkspaceName,
  suggestedWorkspaceColor,
  recentWorkspaces,
  forkContext,
  onCancel,
  onOpenWithoutAi,
}: {
  workingFolder: string | null;
  suggestedWorkspaceName: string;
  suggestedWorkspaceColor: string;
  recentWorkspaces: WorkspaceItem[];
  forkContext?: { provider: CliAgent; attachment: AgentChatHistoryAttachment } | null;
  onCancel: () => void;
  onOpenWithoutAi: (
    terminalCount: number,
    workingFolder: string | null,
    initialCommands?: string[],
    workspaceName?: string,
    workspaceColor?: string,
    workspaceMode?: WorkspaceMode,
    workspaceAgent?: CliAgent | null,
    workspaceAgents?: CliAgent[],
    initialAgentDraft?: string,
    initialHistoryAttachments?: AgentChatHistoryAttachment[],
  ) => void;
}) {
  const [workspaceName, setWorkspaceName] = useState(suggestedWorkspaceName);
  const [workspaceColor, setWorkspaceColor] = useState(
    normalizeWorkspaceAccentColor(suggestedWorkspaceColor),
  );
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const [folderCommand, setFolderCommand] = useState("");
  const [terminalCount, setTerminalCount] =
    useState<(typeof TERMINAL_COUNTS)[number]>(1);
  const [workspaceMode, setWorkspaceMode] =
    useState<WorkspaceMode>(forkContext ? "agent" : "standard");
  const [selectedChatAgent, setSelectedChatAgent] = useState<CliAgent | null>(forkContext?.provider ?? null);
  const [setupStep, setSetupStep] = useState<"layout" | "agents">(forkContext ? "agents" : "layout");
  const [importSessionPickerOpen, setImportSessionPickerOpen] = useState(false);
  const [selectedImportSessions, setSelectedImportSessions] = useState<
    ImportableAgentSession[]
  >([]);
  const [agentCounts, setAgentCounts] = useState<Record<string, number>>({});
  const [forkPrompt, setForkPrompt] = useState("");
  const [isolateAgentWorktrees, setIsolateAgentWorktrees] = useState(false);
  const [agentWorktreeGroup] = useState(worktreeGroup);
  const [customCommand, setCustomCommand] = useState("");
  const [customCommandLoaded, setCustomCommandLoaded] = useState(false);
  const customCommandEditedRef = useRef(false);
  const storedAgentCommands = usePreferencesStore(
    (s) => s.agentLaunchCommands,
  );
  const configuredCliAgentIds = usePreferencesStore((s) => s.cliAgentIds);
  const disabledCliAgentIds = usePreferencesStore(
    (s) => s.disabledCliAgentIds,
  );
  const configuredAgentCliOptions = getEnabledCliAgentDefinitions(
    configuredCliAgentIds,
    disabledCliAgentIds,
  );
  const [agentCommandDrafts, setAgentCommandDrafts] = useState<
    Record<string, string>
  >(() => ({}));
  const recentFolders = recentWorkspaces
    .filter((workspace) => Boolean(workspace.workingFolder))
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    .slice(0, 6);
  const assignedCliTerminals = Object.values(agentCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const assignedAgentTerminals =
    selectedImportSessions.length + assignedCliTerminals;
  const regularTerminals = regularTerminalCount(
    terminalCount,
    selectedImportSessions.length,
    assignedCliTerminals,
  );
  const remainingAgentSlots = regularTerminals;
  const cliTerminalCapacity = Math.max(
    0,
    terminalCount - selectedImportSessions.length,
  );
  // Effective launch command per agent: user override wins, else launch,
  // else the bare command.
  const effectiveAgentCommands = Object.fromEntries(
    configuredAgentCliOptions.map((agent) => [
      agent.id,
      agentCommandDrafts[agent.id]?.trim() ||
        storedAgentCommands[agent.id]?.trim() ||
        agent.launch ||
        agent.command,
    ]),
  ) as Record<string, string>;
  const plannedCliCommands = agentCommandPlan(
    agentCounts,
    customCommand,
    effectiveAgentCommands,
  ).slice(0, cliTerminalCapacity);
  const plannedAgentCommands = [
    ...selectedImportSessions.map((session) =>
      buildSessionResumeCommand(session.provider, session.sessionId),
    ),
    ...plannedCliCommands.map((command, index) =>
      isolateAgentWorktrees
        ? isolatedAgentCommand(
            command,
            `agent-${index + 1}`,
            agentWorktreeGroup,
          )
        : command,
    ),
  ];
  const availableAgents = configuredAgentCliOptions;
  const agentChatAgents = resolveAgentChatWorkspaceAgents({
    configuredIds: configuredCliAgentIds,
    disabledIds: disabledCliAgentIds,
  });
  const visibleAgents = workspaceMode === "agent" ? agentChatAgents : availableAgents;

  const persistCustomCommand = useCallback((command: string) => {
    void invoke("db_save_workspace_setup_custom_command", { command }).catch(
      (error) => {
        console.error("Failed to save custom agent CLI command:", error);
      },
    );
  }, []);

  const persistAgentCommand = (id: string, value: string) => {
    const trimmed = value.trim();
    setAgentCommandDrafts((current) => ({
      ...current,
      [id]: trimmed,
    }));
    const next = { ...storedAgentCommands, [id]: trimmed };
    void setAgentLaunchCommands(next).catch((error) => {
      console.error("Failed to save agent launch command:", error);
    });
  };

  const selectImportSessions = async (
    sessions: ImportableAgentSession[],
  ): Promise<boolean> => {
    if (sessions.length === 0 || sessions.some((session) => session.active)) {
      return false;
    }
    if (sessions.length > remainingAgentSlots) {
      window.alert(
        `Only ${remainingAgentSlots} terminal slots are available for imported sessions.`,
      );
      return false;
    }
    const existingKeys = new Set(
      selectedImportSessions.map(
        (session) => `${session.provider}:${session.sessionId}`,
      ),
    );
    const incomingKeys = sessions.map(
      (session) => `${session.provider}:${session.sessionId}`,
    );
    if (
      new Set(incomingKeys).size !== incomingKeys.length ||
      incomingKeys.some((key) => existingKeys.has(key))
    ) {
      window.alert("One or more agent sessions are already selected.");
      return false;
    }
    setSelectedImportSessions((current) => [...current, ...sessions]);
    return true;
  };

  useEffect(() => {
    let cancelled = false;
    invoke<string>("db_load_workspace_setup_custom_command")
      .then((command) => {
        if (cancelled) return;
        if (!customCommandEditedRef.current) {
          setCustomCommand(command);
        }
        setCustomCommandLoaded(true);
      })
      .catch((error) => {
        console.error("Failed to load custom agent CLI command:", error);
        if (!cancelled) setCustomCommandLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!customCommandLoaded || !customCommandEditedRef.current) return;
    const timeout = window.setTimeout(
      () => persistCustomCommand(customCommand),
      250,
    );
    return () => window.clearTimeout(timeout);
  }, [customCommand, customCommandLoaded, persistCustomCommand]);

  useEffect(() => {
    setSelectedFolder(workingFolder ?? "");
    setFolderCommand("");
  }, [workingFolder]);

  useEffect(() => {
    if (!forkContext) return;
    setWorkspaceMode("agent");
    setSelectedChatAgent(forkContext.provider);
    setSetupStep("agents");
    setAgentCounts({ [forkContext.provider]: 1 });
  }, [forkContext]);

  useEffect(() => {
    const selected = (workspaceMode === "agent" ? agentChatAgents : configuredAgentCliOptions).find(
      (agent) => (agentCounts[agent.id] ?? 0) > 0,
    );
    setSelectedChatAgent(selected?.id ?? agentChatAgents[0]?.id ?? null);
  }, [agentCounts, agentChatAgents, configuredAgentCliOptions, workspaceMode]);

  useEffect(() => {
    setWorkspaceName(suggestedWorkspaceName);
  }, [suggestedWorkspaceName]);

  useEffect(() => {
    setWorkspaceColor(normalizeWorkspaceAccentColor(suggestedWorkspaceColor));
  }, [suggestedWorkspaceColor]);

  const handleBrowse = async () => {
    try {
      const result = await invoke<string | null>("select_folder");
      if (result) {
        setSelectedFolder(result);
      }
    } catch (err) {
      console.error("Failed to select folder:", err);
    }
  };

  const handleApplyFolderCommand = () => {
    const nextFolder = resolveFolderCommand(folderCommand, selectedFolder);
    if (!nextFolder) return;
    setSelectedFolder(nextFolder);
    setFolderCommand("");
  };

  const openWorkspace = useCallback(
    (initialCommands?: string[]) => {
      const selectedWorkspaceAgents = Object.entries(agentCounts).flatMap(
        ([agentId, count]) =>
          agentId === "custom"
            ? []
            : Array.from({ length: count }, () => agentId as CliAgent),
      );
      if (workspaceMode === "agent") {
        selectedWorkspaceAgents.unshift(
          ...selectedImportSessions.map((session) => session.provider),
        );
      }
      const initialAgentDraft = forkContext ? forkPrompt.trim() : undefined;
      onOpenWithoutAi(
        terminalCount,
        selectedFolder || null,
        initialCommands,
        workspaceName,
        workspaceColor,
        workspaceMode,
        workspaceMode === "agent" ? selectedChatAgent : null,
        workspaceMode === "agent"
          ? selectedWorkspaceAgents.slice(0, 12)
          : undefined,
        initialAgentDraft,
        forkContext ? [forkContext.attachment] : undefined,
      );
      onCancel();
    },
    [
      onCancel,
      onOpenWithoutAi,
      selectedFolder,
      terminalCount,
      workspaceColor,
      workspaceMode,
      workspaceName,
      selectedChatAgent,
      agentCounts,
      forkContext,
      forkPrompt,
    ],
  );

  const handleBack = useCallback(() => {
    if (setupStep === "agents") {
      setSetupStep("layout");
      return;
    }
    onCancel();
  }, [onCancel, setupStep]);

  const handlePrimaryAction = useCallback(() => {
    if (setupStep === "layout") {
      setSetupStep("agents");
      return;
    }
    if (plannedAgentCommands.length > 0 && selectedChatAgent) {
      openWorkspace(plannedAgentCommands);
    }
  }, [openWorkspace, plannedAgentCommands, selectedChatAgent, setupStep]);

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (importSessionPickerOpen) return;
      if (event.defaultPrevented || isEditableKeyboardTarget(event.target)) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        handleBack();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        handlePrimaryAction();
      }
    };

    window.addEventListener("keydown", handleKeyboardShortcut);
    return () =>
      window.removeEventListener("keydown", handleKeyboardShortcut);
  }, [handleBack, handlePrimaryAction, importSessionPickerOpen]);

  const setAgentCount = (id: string, nextCount: number) => {
    setAgentCounts((current) => {
      const currentCount = current[id] ?? 0;
      const currentTotal = Object.values(current).reduce(
        (sum, count) => sum + count,
        0,
      );
      const otherCount = currentTotal - currentCount;
      const clamped = Math.min(
        Math.max(0, nextCount),
        Math.max(0, cliTerminalCapacity - otherCount),
      );
      const next = { ...current, [id]: clamped };
      if (clamped === 0) delete next[id];
      if (workspaceMode === "agent" && clamped > 0) setSelectedChatAgent(id as CliAgent);
      return next;
    });
  };

  useEffect(() => {
    setSelectedImportSessions((current) =>
      current.length > terminalCount ? current.slice(0, terminalCount) : current,
    );
  }, [terminalCount]);

  useEffect(() => {
    setAgentCounts((current) => {
      let remaining = cliTerminalCapacity;
      const next: Record<string, number> = {};
      const ids = [
        ...configuredAgentCliOptions.map((agent) => agent.id),
        "custom",
      ];
      for (const id of ids) {
        const count = Math.min(current[id] ?? 0, remaining);
        if (count > 0) next[id] = count;
        remaining -= count;
      }
      return next;
    });
  }, [
    terminalCount,
    cliTerminalCapacity,
    selectedImportSessions.length,
    configuredCliAgentIds,
    disabledCliAgentIds,
  ]);

  useEffect(() => {
    if (customCommand.trim()) return;
    setAgentCounts((current) => {
      if (!current.custom) return current;
      const next = { ...current };
      delete next.custom;
      return next;
    });
  }, [customCommand]);

  if (forkContext) {
    const agentLabel = agentChatAgents.find((agent) => agent.id === selectedChatAgent)?.name
      ?? selectedChatAgent
      ?? "Agent";
    const canCreate = Boolean(selectedChatAgent && selectedFolder);
    return (
      <div className="flex h-full min-h-0 justify-center overflow-y-auto bg-background px-6 py-10 sm:px-10">
        <div className="flex w-full max-w-3xl self-center flex-col gap-5">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">New workspace</h1>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2"><AgentCliIcon agent={forkContext.provider} size="md" />{agentLabel}</span>
            <span>Chat</span>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card/45 p-4 shadow-sm">
            <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/45 px-3 py-2">
              <HugeiconsIcon icon={AiChat01Icon} size={16} strokeWidth={1.8} className="text-muted-foreground" />
              <span><span className="block text-sm font-medium text-foreground">Chat history</span><span className="block text-xs text-muted-foreground">Previous conversation</span></span>
            </div>
            <textarea value={forkPrompt} onChange={(event) => setForkPrompt(event.target.value)} rows={3} placeholder="Message the agent, tag @files, or use /commands and /skills" aria-label="Fork workspace message" className="w-full resize-none bg-transparent px-1 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground" />
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-border/50 pt-3">
              <button type="button" onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <Button type="button" disabled={!canCreate} onClick={() => openWorkspace([])} className="rounded-full px-4">Create workspace <HugeiconsIcon icon={ArrowRight01Icon} size={15} strokeWidth={2} /></Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 justify-center overflow-y-auto bg-background px-6 py-10 sm:px-10 lg:px-14">
      <div className="w-full max-w-[920px] self-start">
        <header className="mb-6 flex flex-col items-center gap-3 text-center sm:mb-8">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {forkContext
              ? "New workspace"
              : setupStep === "layout"
              ? "Set up your workspace"
              : "Add AI coding agents"}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            {forkContext
              ? "Fork the previous conversation into an independent agent workspace."
              : setupStep === "layout"
              ? "Pick a folder to work in and choose how many terminals you want."
              : `Pick which agent CLIs should launch in your ${terminalCount} terminals.`}
          </p>
        </header>

        <div className="space-y-6 sm:space-y-8">
          {forkContext ? (
            <section className="rounded-xl border border-border/60 bg-card/45 p-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground"><HugeiconsIcon icon={AiChat01Icon} size={17} strokeWidth={1.8} /></span>
                <span><span className="block text-sm font-medium text-foreground">Chat history</span><span className="block text-xs text-muted-foreground">Previous conversation</span></span>
              </div>
            </section>
          ) : null}
          {setupStep === "layout" ? (
            <>
              <section className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Workspace name
                  </h3>
                  <span className="text-[11px] text-muted-foreground/70">
                    Shown in the workspace list and tab
                  </span>
                </div>
                <div className="flex h-11 min-w-0 items-center rounded-lg border border-border/50 bg-card/40 px-3 transition-colors focus-within:border-border/80 focus-within:bg-card/60">
                  <WorkspaceColorPicker
                    workspaceName={workspaceName || suggestedWorkspaceName}
                    accentColor={workspaceColor}
                    onColorChange={setWorkspaceColor}
                  />
                  <Input
                    value={workspaceName}
                    onChange={(event) => setWorkspaceName(event.target.value)}
                    onBlur={() => {
                      if (workspaceName.trim().length === 0) {
                        setWorkspaceName(suggestedWorkspaceName);
                      }
                    }}
                    placeholder={suggestedWorkspaceName}
                    className="h-9 min-w-0 flex-1 rounded-none border-0 bg-transparent px-1 text-sm font-semibold text-foreground shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-0"
                    aria-label="Workspace name"
                  />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Workspace mode
                  </h3>
                  <span className="text-[11px] text-muted-foreground/70">
                    Choose a terminal, canvas, or standalone chat surface
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    {
                      mode: "standard" as const,
                      name: "Standard workspace",
                      description: "Your regular terminal workspace",
                    },
                    {
                      mode: "canvas" as const,
                      name: "Canvas workspace",
                      description: "The same workspace, plus a canvas tab",
                    },
                    {
                      mode: "agent" as const,
                      name: "Agent chat workspace",
                      description: "A calm agent timeline over your terminals",
                    },
                  ].map((option) => {
                    const selected = workspaceMode === option.mode;
                    return (
                      <button
                        key={option.mode}
                        type="button"
                        onClick={() => {
                          setWorkspaceMode(option.mode);
                          if (option.mode === "agent") {
                            setTerminalCount(12);
                            setAgentCounts((current) =>
                              Object.fromEntries(
                                Object.entries(current).filter(([id]) =>
                                  agentChatAgents.some((agent) => agent.id === id),
                                ),
                              ),
                            );
                          }
                        }}
                        aria-pressed={selected}
                        className={cn(
                          "flex min-h-16 items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          selected
                            ? "border-primary/60 bg-primary/[0.08] shadow-sm"
                            : "border-border/50 bg-card/40 hover:border-border/80 hover:bg-card/60",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-1 size-3 shrink-0 rounded-full border",
                            selected
                              ? "border-primary bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.14)]"
                              : "border-muted-foreground/40",
                          )}
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">
                            {option.name}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Working folder
                  </h3>
                  <span className="text-[11px] text-muted-foreground/70">
                    Where your terminals will start
                  </span>
                </div>
                <div
                  onClick={handleBrowse}
                  className="flex h-11 min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-border/50 bg-card/40 px-3 transition-colors hover:border-border/80 hover:bg-card/60"
                >
                  <HugeiconsIcon
                    icon={Folder01Icon}
                    size={16}
                    strokeWidth={1.75}
                    className="shrink-0 text-muted-foreground"
                  />
                  <Input
                    value={selectedFolder}
                    readOnly
                    placeholder="Select a working folder"
                    className="h-9 min-w-0 flex-1 cursor-pointer rounded-none border-0 bg-transparent px-1 font-mono text-sm text-foreground shadow-none focus-visible:ring-0"
                    aria-label="Working folder"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBrowse();
                    }}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                    aria-label="Browse folders"
                    title="Browse folders"
                  >
                    <HugeiconsIcon
                      icon={Search01Icon}
                      size={15}
                      strokeWidth={2}
                    />
                  </button>
                </div>
                <div className="flex h-10 min-w-0 items-center gap-2 rounded-lg border border-border/45 bg-muted/30 px-3 font-mono text-sm shadow-inner">
                  <span className="shrink-0 text-muted-foreground/70">
                    &gt;
                  </span>
                  <Input
                    value={folderCommand}
                    onChange={(event) => setFolderCommand(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleApplyFolderCommand();
                      }
                    }}
                    placeholder="cd folder-name"
                    className="h-8 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 font-mono text-sm text-foreground shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-0"
                    aria-label="Change working folder command"
                  />
                  <button
                    type="button"
                    onClick={handleApplyFolderCommand}
                    disabled={
                      !resolveFolderCommand(folderCommand, selectedFolder)
                    }
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-35"
                    aria-label="Apply working folder command"
                    title="Apply working folder command"
                  >
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      size={15}
                      strokeWidth={2}
                    />
                  </button>
                </div>
                {recentFolders.length > 0 ? (
                  <div className="space-y-3 pt-1">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                      <div className="flex items-baseline gap-2">
                        <h3 className="text-sm font-semibold text-foreground">
                          Recents
                        </h3>
                        <span className="text-[11px] font-medium text-muted-foreground/70">
                          {recentFolders.length}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground/80">
                        Last opened workspaces
                      </span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {recentFolders.map((workspace) => {
                        const folder = workspace.workingFolder ?? "";
                        return (
                          <button
                            key={workspace.id}
                            type="button"
                            onClick={() => {
                              setWorkspaceName(workspace.name);
                              setWorkspaceColor(
                                normalizeWorkspaceAccentColor(
                                  workspace.accentColor,
                                  suggestedWorkspaceColor,
                                ),
                              );
                              setSelectedFolder(folder);
                              setTerminalCount(
                                coerceTerminalCount(workspace.count),
                              );
                            }}
                            className="group flex min-w-0 items-center gap-3 rounded-lg border border-border/55 bg-card/45 px-3 py-2 text-left transition-colors hover:border-border/85 hover:bg-card/70"
                          >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/45 text-muted-foreground transition-colors group-hover:text-foreground">
                              <HugeiconsIcon
                                icon={Folder01Icon}
                                size={16}
                                strokeWidth={1.75}
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-foreground">
                                {workspace.name}
                              </span>
                              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                                {recentWorkspaceFolderLabel(folder)}
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                              {workspace.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>

              {workspaceMode !== "agent" ? (
                <>
              <section className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    Presets
                  </h3>
                  <span className="text-[11px] font-medium text-muted-foreground/70">
                    {WORKSPACE_SETUP_PRESETS.length}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {WORKSPACE_SETUP_PRESETS.map((preset) => {
                    const selected = preset.count === terminalCount;
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => setTerminalCount(preset.count)}
                        className={cn(
                          "group flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                          selected
                            ? "border-primary/65 bg-primary/10 text-foreground"
                            : "border-border/50 bg-card/35 text-muted-foreground hover:border-border/80 hover:bg-card/60 hover:text-foreground",
                        )}
                        aria-pressed={selected}
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/45 text-primary/70 transition-colors group-hover:text-primary">
                          <TerminalLayoutGlyph count={preset.count} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">
                            {preset.name}
                          </span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {preset.description}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                          {preset.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      How many terminals?
                    </h3>
                    <span className="text-[11px] text-muted-foreground/70">
                      Tap a tile to choose a layout
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-medium sm:flex sm:gap-4 md:text-right">
                    <span className="text-primary">
                      {terminalCount} terminal
                    </span>
                    <span className="text-muted-foreground">
                      {layoutLabel(terminalCount)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(72px,1fr))] gap-3">
                  {TERMINAL_COUNTS.map((count) => {
                    const selected = count === terminalCount;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setTerminalCount(count)}
                        className={cn(
                          "flex h-18 min-w-0 flex-col items-center justify-center gap-2 rounded-lg border bg-card/20 text-sm font-semibold transition-colors sm:h-20",
                          selected
                            ? "border-primary/70 bg-primary/10 text-foreground shadow-[0_0_0_1px_rgba(59,130,246,0.28),0_0_24px_rgba(59,130,246,0.18)]"
                            : "border-border/40 text-muted-foreground hover:border-border hover:bg-card/50 hover:text-foreground",
                        )}
                        aria-pressed={selected}
                      >
                        <TerminalLayoutGlyph count={count} />
                        <span>{count}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
                </>
              ) : null}
            </>
          ) : (
            <section className="space-y-4">
              <div className="rounded-lg border border-border/55 bg-card/35 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {assignedAgentTerminals} / {terminalCount}
                  </span>
                  <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{
                        width: `${Math.min(100, (assignedAgentTerminals / terminalCount) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {remainingAgentSlots === 0
                      ? "All terminals filled"
                      : `${remainingAgentSlots} regular terminals`}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsolateAgentWorktrees((current) => !current)}
                className="flex w-full items-center gap-3 rounded-lg border border-border/50 bg-card/35 px-3 py-2.5 text-left transition-colors hover:bg-card/55"
                aria-pressed={isolateAgentWorktrees}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                    isolateAgentWorktrees
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-transparent",
                  )}
                >
                  <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.4} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">
                    Isolate agent changes in Git worktrees
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Each new agent gets a dedicated cmdspace branch; closing its pane preserves the worktree.
                  </span>
                </span>
              </button>

              <div
                className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/35 px-3 py-2.5"
                aria-label={`${regularTerminals} regular terminals`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-foreground/[0.06] text-muted-foreground">
                  <HugeiconsIcon
                    icon={ComputerTerminal02Icon}
                    size={16}
                    strokeWidth={2}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">
                    Regular terminals
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    Unassigned slots open as normal shell terminals
                  </div>
                </div>
                <span className="min-w-8 text-center text-sm font-semibold tabular-nums text-foreground">
                  {regularTerminals}
                </span>
              </div>

              <div className="space-y-2 rounded-lg border border-dashed border-primary/35 bg-primary/[0.035] p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HugeiconsIcon
                      icon={Download01Icon}
                      size={17}
                      strokeWidth={2}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">
                      Import existing session
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Resume a native Claude, Codex, OpenCode, or Pi session in this workspace.
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setImportSessionPickerOpen(true)}
                    disabled={remainingAgentSlots === 0}
                    className="w-full sm:w-auto"
                  >
                    Import session
                  </Button>
                </div>

                {selectedImportSessions.length > 0 ? (
                  <div className="space-y-1.5 border-t border-border/40 pt-2">
                    {selectedImportSessions.map((session) => (
                      <div
                        key={`${session.provider}:${session.sessionId}`}
                        className="flex min-w-0 items-center gap-2 rounded-md bg-background/55 px-2.5 py-2"
                      >
                        <AgentCliIcon agent={session.provider} size="md" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold text-foreground">
                            {session.title}
                          </div>
                          <div className="truncate text-[10px] text-muted-foreground">
                            {session.cwd}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedImportSessions((current) =>
                              current.filter(
                                (selected) =>
                                  selected.provider !== session.provider ||
                                  selected.sessionId !== session.sessionId,
                              ),
                            )
                          }
                          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                          aria-label={`Remove imported ${session.title}`}
                          title="Remove imported session"
                        >
                          <HugeiconsIcon
                            icon={Cancel01Icon}
                            size={14}
                            strokeWidth={2}
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {visibleAgents.map((agent) => {
                  const count = agentCounts[agent.id] ?? 0;
                  const selected = count > 0;
                  return (
                    <div
                      key={agent.id}
                      className={cn(
                        "flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
                        selected
                          ? "border-primary/65 bg-primary/10"
                          : "border-border/50 bg-card/35",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setAgentCount(agent.id, selected ? 0 : 1)}
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded border transition-colors",
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-transparent",
                        )}
                        aria-label={`Toggle ${agent.name}`}
                        aria-pressed={selected}
                      >
                        <HugeiconsIcon
                          icon={Tick02Icon}
                          size={13}
                          strokeWidth={2.4}
                        />
                      </button>
                      <AgentCliIcon agent={agent.id} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {agent.name}
                        </div>
                        <Input
                          value={effectiveAgentCommands[agent.id] ?? ""}
                          onChange={(event) =>
                            setAgentCommandDrafts((current) => ({
                              ...current,
                              [agent.id]: event.target.value,
                            }))
                          }
                          onBlur={() =>
                            persistAgentCommand(
                              agent.id,
                              effectiveAgentCommands[agent.id] ?? "",
                            )
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              persistAgentCommand(
                                agent.id,
                                effectiveAgentCommands[agent.id] ?? "",
                              );
                            }
                          }}
                          aria-label={`${agent.name} start command`}
                          spellCheck={false}
                          className="h-6 rounded-md border-border/60 bg-background/40 px-1.5 font-mono text-[11px] text-foreground shadow-none focus-visible:ring-1 focus-visible:ring-primary/40"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setAgentCount(agent.id, count - 1)}
                        disabled={count === 0}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                        aria-label={`Remove ${agent.name} terminal`}
                      >
                        -
                      </button>
                      <span className="w-5 text-center text-sm font-semibold tabular-nums">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAgentCount(agent.id, count + 1)}
                        disabled={remainingAgentSlots === 0}
                        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                        aria-label={`Add ${agent.name} terminal`}
                      >
                        +
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 rounded-lg border border-dashed border-border/70 bg-card/25 p-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setAgentCount("custom", agentCounts.custom ? 0 : 1)
                    }
                    disabled={!customCommand.trim()}
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded border transition-colors disabled:opacity-35",
                      agentCounts.custom
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-transparent",
                    )}
                    aria-label="Toggle custom command"
                    aria-pressed={(agentCounts.custom ?? 0) > 0}
                  >
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      size={13}
                      strokeWidth={2.4}
                    />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-foreground">
                      Custom
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Run your own CLI command
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAgentCount("custom", (agentCounts.custom ?? 0) - 1)
                    }
                    disabled={!agentCounts.custom}
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Remove custom terminal"
                  >
                    -
                  </button>
                  <span className="w-5 text-center text-sm font-semibold tabular-nums">
                    {agentCounts.custom ?? 0}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setAgentCount("custom", (agentCounts.custom ?? 0) + 1)
                    }
                    disabled={
                      !customCommand.trim() || remainingAgentSlots === 0
                    }
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Add custom terminal"
                  >
                    +
                  </button>
                </div>
                <Input
                  value={customCommand}
                  onChange={(event) => {
                    customCommandEditedRef.current = true;
                    setCustomCommand(event.target.value);
                  }}
                  onBlur={() => {
                    if (customCommandLoaded) {
                      persistCustomCommand(customCommand);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && customCommandLoaded) {
                      persistCustomCommand(customCommand);
                    }
                  }}
                  placeholder="e.g. aider --yes-always"
                  className="h-9 font-mono text-sm"
                  aria-label="Custom agent CLI command"
                />
              </div>
            </section>
          )}
        </div>

        <footer className="mt-2 flex flex-col gap-3 pt-2 sm:mt-3 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            className="w-full justify-center text-muted-foreground sm:w-auto"
          >
            <HugeiconsIcon icon={ArrowLeft02Icon} size={14} strokeWidth={2} />
            Back
          </Button>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            {setupStep === "layout" ? (
              <>
                {workspaceMode !== "agent" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => openWorkspace()}
                    className="w-full justify-center text-muted-foreground sm:w-auto"
                  >
                    Open without AI
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="w-full justify-center sm:w-auto"
                >
                   Next: Add AI agents
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={14}
                    strokeWidth={2}
                    data-icon="inline-end"
                  />
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => openWorkspace()}
                  className="w-full justify-center text-muted-foreground sm:w-auto"
                >
                  {workspaceMode === "agent" ? "Back to workspace" : "Skip - no agents"}
                </Button>
                <Button
                  type="button"
                  disabled={
                    plannedAgentCommands.length === 0 ||
                    (workspaceMode === "agent" &&
                      (!selectedChatAgent || !selectedFolder))
                  }
                  onClick={handlePrimaryAction}
                  className="w-full justify-center sm:w-auto"
                >
                  {workspaceMode === "agent"
                    ? "Open agent chat"
                    : `Launch ${terminalCount} terminals`}
                  <HugeiconsIcon
                    icon={ArrowRight01Icon}
                    size={14}
                    strokeWidth={2}
                    data-icon="inline-end"
                  />
                </Button>
              </>
            )}
          </div>
        </footer>
      </div>
      <ImportSessionDialog
        open={importSessionPickerOpen}
        onOpenChange={setImportSessionPickerOpen}
        workspaceName={workspaceName || suggestedWorkspaceName}
        workspaceCwd={selectedFolder || null}
        actionLabel="Add"
        multiple
        onImport={(session) => selectImportSessions([session])}
        onImportMany={selectImportSessions}
      />
    </div>
  );
}

function TerminalLayoutGlyph({
  count,
}: {
  count: (typeof TERMINAL_COUNTS)[number];
}) {
  const cells = Math.min(count, 12);
  const cols = terminalGridColumns(count);
  return (
    <span
      className="grid gap-0.5 text-primary/70"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        width: Math.min(34, cols * 7),
      }}
      aria-hidden="true"
    >
      {Array.from({ length: cells }).map((_, index) => (
        <span
          // static glyph only
          key={index}
          className="size-1.5 rounded-[2px] bg-current"
        />
      ))}
    </span>
  );
}

function terminalGridColumns(count: number): number {
  if (count <= 1) return 1;
  if (count <= 10) return 2;
  return 3;
}

function layoutLabel(count: number): string {
  if (count === 1) return "1 x 1 grid";
  if (count === 2) return "2 x 1 grid";
  if (count === 4) return "2 x 2 grid";
  if (count === 6) return "2 x 3 grid";
  if (count === 8) return "2 x 4 grid";
  if (count === 10) return "2 x 5 grid";
  return "3 x 4 grid";
}

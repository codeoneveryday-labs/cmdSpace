import { cn } from "@/lib/utils";
import {
  Add01Icon,
  Cancel01Icon,
  ComputerTerminal02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { WorkspaceItem, WorkspaceTerminalItem } from "./WorkspacesPanel";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import { AgentStateDot } from "@/modules/terminal/AgentStateDot";
import { TerminalAgentSwitcher } from "@/modules/terminal/TerminalAgentSwitcher";

export function WorkspaceTerminalList({
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

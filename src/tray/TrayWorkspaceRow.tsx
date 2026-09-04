import { cn } from "@/lib/utils";
import { truncateMiddle } from "@/lib/truncateMiddle";
import {
  AiChat01Icon,
  ArrowDown01Icon,
  CanvasIcon,
  ComputerTerminal02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import { detectCliAgent, type CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { TrayTerminal, TrayWorkspace } from "./workspaces";

export function TrayWorkspaceRow({
  workspace,
  selected,
  expanded,
  onToggleExpanded,
  onOpen,
  onOpenTerminal,
  onHover,
}: {
  workspace: TrayWorkspace;
  selected: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
  onOpen: () => void;
  onOpenTerminal?: (terminal: TrayTerminal, paneIndex: number) => void;
  onHover: () => void;
}) {
  const canvas = workspace.workspaceMode === "canvas";
  const primaryAgent =
    (workspace.agentProvider as CliAgent | undefined) ||
    (workspace.terminals?.length === 1
      ? (workspace.terminals[0].agent ?? detectCliAgent(workspace.terminals[0].label))
      : null);

  return (
    <div className="space-y-0.5">
      <button
        aria-selected={selected}
        className={cn(
          "group flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors",
          selected
            ? "bg-accent text-accent-foreground"
            : "hover:bg-muted/70 focus-visible:bg-muted/70",
        )}
        onClick={onOpen}
        onMouseEnter={onHover}
        role="option"
        type="button"
      >
        <span
          className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onToggleExpanded();
          }}
          aria-hidden="true"
        >
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={14}
            strokeWidth={2}
            className={cn("transition-transform", !expanded && "-rotate-90")}
          />
        </span>
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/70"
          style={{ color: workspace.accentColor ?? undefined }}
        >
          {primaryAgent ? (
            <AgentCliIcon agent={primaryAgent} size="md" />
          ) : (
            <HugeiconsIcon
              icon={canvas ? CanvasIcon : workspace.workspaceMode === "agent" ? AiChat01Icon : ComputerTerminal02Icon}
              size={18}
              strokeWidth={1.8}
            />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium" title={workspace.name}>
            {truncateMiddle(workspace.name, 28)}
          </span>
          <span
            className="mt-0.5 block truncate text-xs text-muted-foreground"
            title={workspaceSubtitle(workspace)}
          >
            {workspaceSubtitle(workspace)}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/60">
          {workspace.count}
        </span>
      </button>
      {expanded ? (
        <div className="ml-5 space-y-0.5 border-l border-border/60 pl-2">
          {(workspace.terminals ?? []).map((terminal, index) => {
            const agent = terminal.agent ?? detectCliAgent(terminal.label);
            const paneIndex = terminal.paneIndex ?? index;
            return (
              <button
                key={terminal.label}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenTerminal) {
                    onOpenTerminal(terminal, paneIndex);
                  } else {
                    onOpen();
                  }
                }}
                className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                title={terminal.label}
              >
                {agent ? (
                  <AgentCliIcon agent={agent} size="md" className="shrink-0" />
                ) : (
                  <HugeiconsIcon
                    icon={ComputerTerminal02Icon}
                    size={14}
                    strokeWidth={1.8}
                    className="shrink-0"
                  />
                )}
                <span className="min-w-0 flex-1 truncate" title={terminal.label}>{terminal.label}</span>
              </button>
            );
          })}
          {(workspace.terminals ?? []).length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              No terminals open
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function workspaceSubtitle(workspace: TrayWorkspace): string {
  if (workspace.workingFolder) return workspace.workingFolder;
  if (workspace.workspaceMode === "agent") return "Agent chat workspace";
  return workspace.workspaceMode === "canvas"
    ? "Canvas workspace"
    : "Terminal workspace";
}


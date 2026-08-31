import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Cancel01Icon,
  ComputerTerminal02Icon,
  Download01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Dispatch, SetStateAction } from "react";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import type { ImportableAgentSession } from "./lib/importSessions";

export function WorkspaceAgentAssignmentSummary({
  assignedAgentTerminals,
  terminalCount,
  remainingAgentSlots,
  isolateAgentWorktrees,
  setIsolateAgentWorktrees,
  regularTerminals,
  selectedImportSessions,
  setSelectedImportSessions,
  setImportSessionPickerOpen,
}: {
  assignedAgentTerminals: number;
  terminalCount: number;
  remainingAgentSlots: number;
  isolateAgentWorktrees: boolean;
  setIsolateAgentWorktrees: Dispatch<SetStateAction<boolean>>;
  regularTerminals: number;
  selectedImportSessions: ImportableAgentSession[];
  setSelectedImportSessions: Dispatch<SetStateAction<ImportableAgentSession[]>>;
  setImportSessionPickerOpen: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <>
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
          <HugeiconsIcon icon={ComputerTerminal02Icon} size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground">Regular terminals</div>
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
            <HugeiconsIcon icon={Download01Icon} size={17} strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">Import existing session</div>
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
                  <div className="truncate text-xs font-semibold text-foreground">{session.title}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{session.cwd}</div>
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
                  <HugeiconsIcon icon={Cancel01Icon} size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

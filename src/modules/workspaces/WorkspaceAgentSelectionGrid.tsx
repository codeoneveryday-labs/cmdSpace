import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { Dispatch, SetStateAction } from "react";
import type { CliAgentDefinition } from "@/modules/terminal/lib/cliAgents";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";

export function WorkspaceAgentSelectionGrid({
  visibleAgents,
  agentCounts,
  remainingAgentSlots,
  customCommand,
  customCommandLoaded,
  effectiveAgentCommands,
  setAgentCount,
  setAgentCommandDrafts,
  persistAgentCommand,
  setCustomCommand,
  persistCustomCommand,
}: {
  visibleAgents: CliAgentDefinition[];
  agentCounts: Record<string, number>;
  remainingAgentSlots: number;
  customCommand: string;
  customCommandLoaded: boolean;
  effectiveAgentCommands: Record<string, string>;
  setAgentCount: (id: string, nextCount: number) => void;
  setAgentCommandDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  persistAgentCommand: (id: string, value: string) => void;
  setCustomCommand: (value: SetStateAction<string>) => void;
  persistCustomCommand: (command: string) => void;
}) {
  return (
    <>
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
                <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.4} />
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
            onClick={() => setAgentCount("custom", agentCounts.custom ? 0 : 1)}
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
            <HugeiconsIcon icon={Tick02Icon} size={13} strokeWidth={2.4} />
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground">Custom</div>
            <div className="text-[11px] text-muted-foreground">
              Run your own CLI command
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAgentCount("custom", (agentCounts.custom ?? 0) - 1)}
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
            onClick={() => setAgentCount("custom", (agentCounts.custom ?? 0) + 1)}
            disabled={!customCommand.trim() || remainingAgentSlots === 0}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
            aria-label="Add custom terminal"
          >
            +
          </button>
        </div>
        <Input
          value={customCommand}
          onChange={(event) => setCustomCommand(event.target.value)}
          onBlur={() => {
            if (customCommandLoaded) persistCustomCommand(customCommand);
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
    </>
  );
}

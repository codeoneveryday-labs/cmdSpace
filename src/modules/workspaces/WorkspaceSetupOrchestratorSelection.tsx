import { cn } from "@/lib/utils";
import type { OrchestrationProvider } from "@/modules/tabs";
import type { CliAgentDefinition } from "@/modules/terminal/lib/cliAgents";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";

export function WorkspaceSetupOrchestratorSelection({
  options,
  selectedProvider,
  onSelect,
}: {
  options: CliAgentDefinition[];
  selectedProvider: OrchestrationProvider;
  onSelect: (provider: OrchestrationProvider) => void;
}) {
  return (
    <section className="space-y-4" aria-labelledby="orchestrator-selection-heading">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-2">
        <h2 id="orchestrator-selection-heading" className="text-sm font-semibold text-foreground">
          Select the orchestrator
        </h2>
        <span className="text-[11px] text-muted-foreground/70">
          This CLI is the boss that proposes the graph and coordinates workers.
        </span>
      </div>
      {options.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((agent) => {
            const selected = selectedProvider === agent.id;
            const recommended = agent.id === "codex" || agent.id === "claude";
            return (
              <button
                key={agent.id}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(agent.id as OrchestrationProvider)}
                className={cn(
                  "flex min-h-20 items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                  selected
                    ? "border-primary/70 bg-primary/[0.10] shadow-sm"
                    : "border-border/60 bg-card/35 hover:border-border hover:bg-card/60",
                )}
              >
                <AgentCliIcon agent={agent.id} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{agent.name}</span>
                    {recommended ? (
                      <span className="shrink-0 rounded border border-amber-400/50 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-200">
                        Recommended
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">{agent.command}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-3 shrink-0 rounded-full border",
                    selected
                      ? "border-primary bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.14)]"
                      : "border-muted-foreground/40",
                  )}
                />
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-amber-400/40 bg-amber-500/[0.08] p-3 text-xs text-amber-800 dark:text-amber-200">
          Enable Codex, Claude Code, or Command Code in Settings before creating an orchestration Canvas.
        </p>
      )}
    </section>
  );
}

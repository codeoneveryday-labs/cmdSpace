import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import {
  getEnabledCliAgentDefinitions,
  type CliAgent,
  type CliAgentDefinition,
} from "@/modules/terminal/lib/cliAgents";
import { loadPreferences } from "@/modules/settings/store";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { invoke } from "@tauri-apps/api/core";
import { Refresh01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

type AgentRateLimit = {
  label: string;
  usedPercent: number;
  windowMinutes?: number;
  resetsAt?: number;
};

type ProviderLimitStatus = {
  provider: string;
  rateLimits: AgentRateLimit[];
  accountUsage?: {
    plan?: string;
    usedPercent?: number;
    creditsRemaining?: number;
    requestCount?: number;
  };
  sessionUsage?: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    costUsd?: number;
  };
  observedAt: number;
};

type Props = {
  trigger: ReactNode;
};

const USAGE_TRACKED_CLI_AGENT_IDS = new Set<CliAgent>([
  "codex",
  "claude",
  "opencode",
  "cmd",
]);

export function ProviderUsagePopover({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<ProviderLimitStatus[]>([]);
  const [agents, setAgents] = useState<CliAgentDefinition[]>([]);
  const [pendingProviders, setPendingProviders] = useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    let nextAgents: CliAgentDefinition[];
    try {
      const preferences = await loadPreferences();
      nextAgents = getEnabledCliAgentDefinitions(
        preferences.cliAgentIds,
        preferences.disabledCliAgentIds,
      ).filter((agent) => USAGE_TRACKED_CLI_AGENT_IDS.has(agent.id));
      if (id === requestId.current) setAgents(nextAgents);
    } catch {
      if (id === requestId.current) {
        setError("CLI Agent settings are unavailable right now.");
        setLoading(false);
      }
      return;
    }
    if (id !== requestId.current) return;

    setPendingProviders(new Set(nextAgents.map((agent) => agent.id)));
    await Promise.allSettled(
      nextAgents.map(async (agent) => {
        try {
          const next = await invoke<ProviderLimitStatus | null>(
            "provider_limit_status",
            { provider: agent.id },
          );
          if (id === requestId.current) {
            setStatuses((current) => {
              const otherProviders = current.filter(
                (status) => status.provider !== agent.id,
              );
              return next ? [...otherProviders, next] : otherProviders;
            });
          }
        } catch {
          if (id === requestId.current) {
            setError("Some provider limits are unavailable right now.");
          }
        } finally {
          if (id === requestId.current) {
            setPendingProviders((current) => {
              const nextPending = new Set(current);
              nextPending.delete(agent.id);
              return nextPending;
            });
          }
        }
      }),
    );
    if (id === requestId.current) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0"
      >
        <PopoverHeader className="gap-1 border-b border-border/60 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <PopoverTitle>Provider limits</PopoverTitle>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-md"
              onClick={() => void refresh()}
              disabled={loading}
              aria-label="Refresh provider limits"
              title="Refresh provider limits"
            >
              <HugeiconsIcon
                icon={Refresh01Icon}
                size={15}
                strokeWidth={1.75}
                className={loading ? "animate-spin" : undefined}
              />
            </Button>
          </div>
          <PopoverDescription>
            Uses local CLI telemetry and supported signed-in provider data. Credentials stay on this device.
          </PopoverDescription>
        </PopoverHeader>

        <div className="max-h-[min(26rem,calc(100vh-8rem))] overflow-y-auto p-2">
          {agents.map((agent) => {
            const status = statuses.find((item) => item.provider === agent.id);
            return (
              <ProviderLimitCard
                key={agent.id}
                agent={agent.id}
                name={agent.name}
                status={status}
                pending={pendingProviders.has(agent.id)}
              />
            );
          })}
          {!loading && agents.length === 0 ? (
            <p className="px-2 py-3 text-xs leading-relaxed text-muted-foreground">
              Enable a CLI Agent in Settings to show it here.
            </p>
          ) : null}
          {error ? (
            <p className="px-2 pb-2 text-xs text-destructive" role="status">
              {error}
            </p>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ProviderLimitCard({
  name,
  agent,
  status,
  pending,
}: {
  name: string;
  agent: CliAgent;
  status?: ProviderLimitStatus;
  pending: boolean;
}) {
  return (
    <section className="rounded-xl px-2 py-2.5 hover:bg-accent/50">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <AgentCliIcon agent={agent} size="md" />
          {name}
        </h3>
        {status ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            updated {formatAge(status.observedAt)}
          </span>
        ) : null}
      </div>
      {pending && !status ? (
        <div
          className="mt-2 space-y-2"
          aria-label={`Loading ${name} provider limits`}
        >
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-24 rounded-md" />
            <Skeleton className="h-3 w-20 rounded-md" />
          </div>
          <Skeleton className="h-1.5 w-full rounded-full" />
        </div>
      ) : status ? (
        <div className="mt-2 space-y-2">
          {status.accountUsage ? (
            <div className="space-y-1 text-xs">
              {status.accountUsage.plan || status.accountUsage.usedPercent !== undefined ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-mono font-medium text-foreground">
                    {status.accountUsage.plan ?? "Command Code"}
                    {status.accountUsage.usedPercent !== undefined
                      ? ` · ${status.accountUsage.usedPercent}% used`
                      : ""}
                  </span>
                </div>
              ) : null}
              {status.accountUsage.creditsRemaining !== undefined ||
              status.accountUsage.requestCount !== undefined ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Cycle</span>
                  <span className="font-mono font-medium text-foreground">
                    {status.accountUsage.creditsRemaining !== undefined
                      ? `${formatCredits(status.accountUsage.creditsRemaining)} left`
                      : ""}
                    {status.accountUsage.requestCount !== undefined
                      ? `${status.accountUsage.creditsRemaining !== undefined ? " · " : ""}${status.accountUsage.requestCount.toLocaleString()} requests`
                      : ""}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
          {status.rateLimits.map((limit) => (
            <div key={limit.label}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="text-muted-foreground">
                  {limit.label}
                  {limit.windowMinutes ? ` · ${formatWindow(limit.windowMinutes)}` : ""}
                </span>
                <span className="font-mono font-medium text-foreground">
                  {limit.usedPercent}% used{formatReset(limit.resetsAt)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-foreground/75 transition-[width] duration-200"
                  style={{ width: `${limit.usedPercent}%` }}
                />
              </div>
            </div>
          ))}
          {status.sessionUsage ? (
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">Local session usage</span>
              <span className="font-mono font-medium text-foreground">
                {formatTokens(
                  status.sessionUsage.inputTokens + status.sessionUsage.outputTokens,
                )}
                {status.sessionUsage.costUsd !== undefined
                  ? ` · $${status.sessionUsage.costUsd.toFixed(2)}`
                  : ""}
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          No usage or account limit reported locally yet.
        </p>
      )}
    </section>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M tokens`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K tokens`;
  return `${tokens} tokens`;
}

function formatCredits(credits: number): string {
  return `$${credits.toFixed(2)}`;
}

function formatWindow(minutes: number): string {
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

function formatAge(timestamp: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() / 1000 - timestamp) / 60));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function formatReset(timestamp?: number): string {
  if (!timestamp) return "";
  const reset = new Date(timestamp * 1000);
  if (Number.isNaN(reset.getTime())) return "";
  return ` · ${reset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

import { Button } from "@/components/ui/button";
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
  observedAt: number;
};

const KNOWN_PROVIDERS = [
  { id: "codex", name: "Codex" },
  { id: "claude", name: "Claude Code" },
] as const;

type Props = {
  trigger: ReactNode;
};

export function ProviderUsagePopover({ trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [statuses, setStatuses] = useState<ProviderLimitStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const next = await invoke<ProviderLimitStatus[]>("provider_limit_statuses");
      if (id === requestId.current) setStatuses(next);
    } catch {
      if (id === requestId.current) {
        setError("Provider limits are unavailable right now.");
      }
    } finally {
      if (id === requestId.current) setLoading(false);
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
            Local CLI telemetry. No credentials or account data leave cmdSpace.
          </PopoverDescription>
        </PopoverHeader>

        <div className="max-h-[min(26rem,calc(100vh-8rem))] overflow-y-auto p-2">
          {KNOWN_PROVIDERS.map((provider) => {
            const status = statuses.find((item) => item.provider === provider.id);
            return (
              <ProviderLimitCard
                key={provider.id}
                name={provider.name}
                status={status}
                loading={loading}
              />
            );
          })}
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
  status,
  loading,
}: {
  name: string;
  status?: ProviderLimitStatus;
  loading: boolean;
}) {
  return (
    <section className="rounded-xl px-2 py-2.5 hover:bg-accent/50">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{name}</h3>
        {status ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            updated {formatAge(status.observedAt)}
          </span>
        ) : null}
      </div>
      {loading && !status ? (
        <div className="mt-2 h-9 animate-pulse rounded-md bg-muted" aria-label="Loading provider limits" />
      ) : status ? (
        <div className="mt-2 space-y-2">
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
        </div>
      ) : (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          No account limit reported locally. Open a session to populate it.
        </p>
      )}
    </section>
  );
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

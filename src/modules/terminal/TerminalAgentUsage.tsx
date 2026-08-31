import { useEffect, useRef, useState } from "react";
import { detectCliAgent } from "./lib/cliAgents";
import {
  getAgentUsageStatuses,
  type AgentUsageStatus,
} from "./lib/terminal-native";

export function useTerminalAgentUsage({
  cwd,
  agentCommand,
  focused,
  hydrated,
}: {
  cwd: string | undefined;
  agentCommand: string | undefined;
  focused: boolean;
  hydrated: boolean;
}) {
  const [agentUsage, setAgentUsage] = useState<AgentUsageStatus[]>([]);
  const [usageOpen, setUsageOpen] = useState(false);
  const usageMenuRef = useRef<HTMLDivElement>(null);
  const cliAgent = detectCliAgent(agentCommand);
  const supportsUsage = cliAgent === "codex" || cliAgent === "claude";
  const activeAgentUsage = supportsUsage
    ? agentUsage.find((status) => status.provider === cliAgent)
    : undefined;

  useEffect(() => {
    if (!hydrated || !cwd || !supportsUsage) {
      setAgentUsage([]);
      setUsageOpen(false);
      return;
    }

    let disposed = false;
    const refreshAgentUsage = async () => {
      try {
        const statuses = await getAgentUsageStatuses(cwd);
        if (!disposed) setAgentUsage(statuses);
      } catch (error) {
        void error;
      }
    };

    void refreshAgentUsage();
    const interval = focused ? window.setInterval(refreshAgentUsage, 15_000) : null;
    return () => {
      disposed = true;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [cwd, focused, hydrated, supportsUsage]);

  return {
    activeAgentUsage,
    agentUsage,
    cliAgent,
    supportsUsage,
    usageOpen,
    usageMenuRef,
    setUsageOpen,
  };
}

export function AgentUsageBadge({ status }: { status: AgentUsageStatus }) {
  const remaining = status.contextRemainingPercent;
  if (remaining === undefined) return null;

  return (
    <span
      className="inline-flex h-5 shrink-0 items-center rounded-sm bg-muted px-1.5 font-mono text-[10px] font-semibold text-foreground dark:bg-zinc-800 dark:text-zinc-100"
      title={`${status.provider === "codex" ? "Codex" : "Claude"} context remaining${status.contextIsEstimated ? " (estimated)" : ""}`}
    >
      {status.contextIsEstimated ? "~" : ""}{remaining}%
    </span>
  );
}

export function AgentUsageMenu({ statuses }: { statuses: AgentUsageStatus[] }) {
  return (
    <div className="absolute left-0 top-full z-30 mt-2.5 w-72 rounded-lg border border-border bg-popover/95 p-2 text-left text-popover-foreground shadow-2xl backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Coding agent usage
      </div>
      {statuses.length === 0 ? (
        <div className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">
          No local session usage found for this folder yet.
        </div>
      ) : (
        statuses.map((status) => (
          <div key={status.provider} className="border-t border-border/60 px-2 py-2 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold capitalize text-foreground dark:text-zinc-100">{status.provider}</span>
              {status.contextRemainingPercent !== undefined ? (
                <span className="font-mono text-xs font-semibold text-foreground dark:text-zinc-100">
                  {status.contextIsEstimated ? "~" : ""}{status.contextRemainingPercent}% left
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Context window {formatTokenCount(status.contextTokens)} / {formatTokenCount(status.contextWindow)}
              {status.contextIsEstimated ? " · estimated" : ""}
            </div>
            <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Account limits</div>
            {status.rateLimits.length === 0 ? (
              <div className="mt-1 text-[11px] text-muted-foreground">Not reported by this local session.</div>
            ) : (
              status.rateLimits.map((limit) => (
                <div key={limit.label} className="mt-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span>{limit.label}{limit.windowMinutes ? ` · ${limit.windowMinutes}m` : ""}</span>
                  <span>{limit.usedPercent}% used{formatReset(limit.resetsAt)}</span>
                </div>
              ))
            )}
          </div>
        ))
      )}
      <div className="border-t border-border/60 px-2 pt-2 text-[10px] leading-relaxed text-muted-foreground dark:border-zinc-800">
        Read locally from CLI session logs. No account token is sent to the UI.
      </div>
    </div>
  );
}

function formatTokenCount(value?: number): string {
  if (value === undefined) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

function formatReset(timestamp?: number): string {
  if (!timestamp) return "";
  const reset = new Date(timestamp * 1000);
  if (Number.isNaN(reset.getTime())) return "";
  return ` · resets ${reset.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

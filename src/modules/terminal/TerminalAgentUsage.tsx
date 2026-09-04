import { useEffect, useRef, useState } from "react";
import { detectCliAgent } from "./lib/cliAgents";
import type { AgentDisplayState } from "./AgentStateDot";
import {
  getAgentUsageStatuses,
  type AgentUsageStatus,
} from "./lib/terminal-native";
import {
  formatResetDateTime,
  formatUsageWindow,
} from "@/modules/usage/usageResetTime";

const PROVIDER_DISPLAY_NAMES: Record<AgentUsageStatus["provider"], string> = {
  codex: "Codex",
  claude: "Claude",
  omp: "omp",
  cmd: "Command Code",
  opencode: "OpenCode",
};

/// Matches OpenCode's default session title as rendered in the TUI sidebar
/// (e.g. "New session - 2026-09-03T11:35:14.641Z"). The title is stored
/// verbatim in opencode.db, so the full match pins usage lookups to the
/// session running in this pane instead of the newest session in the folder.
const OPENCODE_SESSION_TITLE_PATTERN =
  /New session - \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/;

export function extractOpenCodeSessionTitle(
  text: string | null | undefined,
): string | null {
  if (!text) return null;
  const match = OPENCODE_SESSION_TITLE_PATTERN.exec(text);
  return match ? match[0] : null;
}

export function extractNativeSessionId(
  command: string | undefined,
  agent: string | null,
): string | null {
  if (!command || !agent) return null;
  const sessionPath = command.match(/(?:--session|-s)\s+["']([^"']+\.jsonl)["']/i)?.[1];
  if (sessionPath) {
    const sessionId = sessionPath
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.jsonl$/i, "");
    if (sessionId && /^[A-Za-z0-9_-]{1,100}$/.test(sessionId)) return sessionId;
  }
  const match = command.match(
    /(?:--session|-s|--resume|-r|resume)\s+["']?((?:ses_[A-Za-z0-9_-]+|[0-9a-f]{8}-[0-9a-f-]{27,}))(?=["']?(?:\s|$))/i,
  );
  return match?.[1] ?? null;
}

export function useTerminalAgentUsage({
  cwd,
  agentCommand,
  focused,
  hydrated,
  getBuffer,
  getSessionStartedAt,
  agentState,
}: {
  cwd: string | undefined;
  agentCommand: string | undefined;
  focused: boolean;
  hydrated: boolean;
  getBuffer?: () => string | null;
  getSessionStartedAt?: () => number | undefined;
  agentState?: AgentDisplayState;
}) {
  const [agentUsage, setAgentUsage] = useState<AgentUsageStatus[]>([]);
  const [nativeSessionId, setNativeSessionId] = useState<string | null>(null);
  const [nativeSessionProvider, setNativeSessionProvider] = useState<string | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const usageMenuRef = useRef<HTMLDivElement>(null);
  const cliAgent = detectCliAgent(agentCommand);
  const commandNativeSessionId = extractNativeSessionId(agentCommand, cliAgent);
  const supportsUsage =
    cliAgent === "codex" ||
    cliAgent === "claude" ||
    cliAgent === "omp" ||
    cliAgent === "cmd" ||
    cliAgent === "opencode";
  const activeAgentUsage = supportsUsage
    ? agentUsage.find((status) => status.provider === cliAgent)
    : undefined;

  useEffect(() => {
    if (!hydrated || !cwd || !supportsUsage) {
      setAgentUsage([]);
      setNativeSessionId(null);
      setNativeSessionProvider(null);
      setUsageOpen(false);
      return;
    }

    let disposed = false;
    const refreshAgentUsage = async () => {
      try {
        // Read the pane's own buffer every refresh: the OpenCode sidebar
        // renders its session title, which resolves the per-pane session even
        // when several sessions share this cwd.
        const sessionTitleHint =
          cliAgent === "opencode"
            ? extractOpenCodeSessionTitle(getBuffer?.() ?? null)
            : null;
        const sessionStartedAtMs = getSessionStartedAt?.();
        const statuses = await getAgentUsageStatuses(
          cwd,
          cliAgent,
          nativeSessionProvider === cliAgent
            ? nativeSessionId
            : commandNativeSessionId,
          sessionTitleHint,
          sessionStartedAtMs,
        );
        if (!disposed) {
          setAgentUsage(statuses);
          setNativeSessionId(statuses[0]?.nativeSessionId ?? null);
          setNativeSessionProvider(statuses[0]?.provider ?? null);
        }
      } catch (error) {
        void error;
      }
    };

    // The pane's display state changes when a response completes. Including it
    // in this effect makes that transition re-run the same session-id lookup
    // immediately instead of waiting for the polling interval.
    void refreshAgentUsage();
    const interval = focused ? window.setInterval(refreshAgentUsage, 15_000) : null;
    return () => {
      disposed = true;
      if (interval !== null) window.clearInterval(interval);
    };
  }, [
    cwd,
    focused,
    hydrated,
    supportsUsage,
    cliAgent,
    getBuffer,
    getSessionStartedAt,
    nativeSessionId,
    nativeSessionProvider,
    agentCommand,
    agentState,
  ]);

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
  const used =
    remaining !== undefined
      ? 100 - remaining
      : status.contextTokens !== undefined && status.contextWindow
        ? Math.min(
            100,
            Math.round((status.contextTokens / status.contextWindow) * 100),
          )
        : undefined;
  if (used === undefined) return null;
  const providerName = PROVIDER_DISPLAY_NAMES[status.provider] ?? status.provider;

  return (
    <span
      className="inline-flex h-5 shrink-0 items-center rounded-sm bg-muted px-1.5 font-mono text-[10px] font-semibold text-foreground dark:bg-zinc-800 dark:text-zinc-100"
      title={`${providerName} context used${status.contextIsEstimated ? " (estimated)" : ""}`}
    >
      {status.contextIsEstimated ? "~" : ""}{used}%
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
                  <span>{limit.label}{limit.windowMinutes ? ` · ${formatUsageWindow(limit.windowMinutes)}` : ""}</span>
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
  const stamp = formatResetDateTime(timestamp);
  return stamp ? ` · resets ${stamp}` : "";
}

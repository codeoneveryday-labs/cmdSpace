import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { setPreventSleep } from "@/modules/settings/store";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import type { CliAgentDefinition } from "@/modules/terminal/lib/cliAgents";
import {
  USAGE_BAR_TONE_CLASS,
  USAGE_TEXT_TONE_CLASS,
  usagePercentTone,
} from "@/modules/usage/usagePercentTone";
import {
  formatResetWeekday,
  formatUsageWindow,
} from "@/modules/usage/usageResetTime";
import { Coffee02Icon, Moon02Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampSelectionIndex,
  filterTrayWorkspaces,
} from "./workspaces";
import {
  hasUsageData,
  useTrayProviderUsage,
  type ProviderLimitStatus,
} from "./useTrayProviderUsage";
import { useTrayWorkspaceData } from "./useTrayWorkspaceData";
import { TrayWorkspaceRow } from "./TrayWorkspaceRow";

export function WorkspaceSwitcher() {
  const { workspaces, loading, error, refresh } = useTrayWorkspaceData();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const {
    refreshUsage,
    usageAgents,
    statuses,
    pendingProviders,
    visibleUsage,
    hasPendingUsage,
  } = useTrayProviderUsage();
  const searchRef = useRef<HTMLInputElement>(null);

  const visibleWorkspaces = useMemo(
    () => filterTrayWorkspaces(workspaces, query),
    [query, workspaces],
  );

  useEffect(() => {
    setExpandedWorkspaceIds(
      new Set(workspaces.map((workspace) => workspace.id)),
    );
    setSelectedIndex(workspaces.length > 0 ? 0 : -1);
  }, [workspaces]);

  const hide = useCallback(() => {
    void invoke("hide_workspace_switcher");
  }, []);

  const openWorkspace = useCallback((workspaceId: string) => {
    void invoke("open_workspace_from_tray", { workspaceId });
  }, []);

  const [preventSleep, setPreventSleepState] = useState(false);

  const refreshPreventSleep = useCallback(async () => {
    try {
      const active = await invoke<boolean>("get_prevent_sleep");
      setPreventSleepState(active);
    } catch {
      /* ignore */
    }
  }, []);

  const togglePreventSleep = useCallback(async () => {
    const next = !preventSleep;
    try {
      await invoke("set_prevent_sleep", { enabled: next });
      await setPreventSleep(next);
      setPreventSleepState(next);
    } catch {
      /* ignore */
    }
  }, [preventSleep]);

  useEffect(() => {
    void refresh();
    void refreshUsage();
    void refreshPreventSleep();
    const unlistenOpen = listen("cmdspace:tray-opened", () => {
      setQuery("");
      setSelectedIndex(0);
      void refresh();
      void refreshUsage();
      void refreshPreventSleep();
      window.setTimeout(() => searchRef.current?.focus(), 0);
    });
    const unlistenFocus = getCurrentWindow().onFocusChanged(
      ({ payload: focused }) => {
        if (!focused) hide();
      },
    );

    return () => {
      void unlistenOpen.then((unlisten) => unlisten());
      void unlistenFocus.then((unlisten) => unlisten());
    };
  }, [hide, refresh, refreshPreventSleep, refreshUsage]);

  const toggleWorkspaceExpanded = (workspaceId: string) => {
    setExpandedWorkspaceIds((current) => {
      const next = new Set(current);
      if (next.has(workspaceId)) next.delete(workspaceId);
      else next.add(workspaceId);
      return next;
    });
  };

  useEffect(() => {
    setSelectedIndex((current) =>
      clampSelectionIndex(current, visibleWorkspaces.length),
    );
  }, [visibleWorkspaces.length]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      hide();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (visibleWorkspaces.length === 0) return;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setSelectedIndex((current) => {
        const next = current < 0 ? 0 : current + delta;
        return (next + visibleWorkspaces.length) % visibleWorkspaces.length;
      });
      return;
    }
    if (event.key === "Enter") {
      const workspace = visibleWorkspaces[selectedIndex];
      if (workspace) {
        event.preventDefault();
        openWorkspace(workspace.id);
      }
    }
  };

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-transparent p-3 text-foreground"
      onKeyDown={handleKeyDown}
    >
      <section className="tray-panel relative flex h-full flex-col overflow-hidden rounded-[18px] border border-border/80 bg-popover/98 shadow-[0_6px_16px_-8px_rgba(15,23,42,0.38)]">
        <header className="border-b border-border/70 px-4 pb-3 pt-4">
          <h1 className="text-[15px] font-semibold tracking-tight">Workspaces</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Jump back into cmdSpace
          </p>
          <label className="mt-3 flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-muted/55 px-3 text-muted-foreground focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15">
            <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={1.8} />
            <input
              ref={searchRef}
              aria-label="Search workspaces"
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              placeholder="Search workspaces"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedIndex(0);
              }}
            />
          </label>
          {visibleUsage.length > 0 || hasPendingUsage ? (
            <section
              aria-label="Provider usage"
              className="mt-3 rounded-xl border border-border/60 bg-muted/35 px-3 py-2.5"
            >
              <h2 className="text-xs font-medium text-muted-foreground">
                Provider usage
              </h2>
              <div className="mt-2 max-h-24 space-y-2.5 overflow-y-auto">
                {usageAgents.map((agent) => {
                  const status = statuses.find(
                    (item) => item.provider === agent.id,
                  );
                  if (pendingProviders.has(agent.id) && !status) {
                    return (
                      <div
                        aria-label={`Loading ${agent.name} usage`}
                        className="space-y-1.5"
                        key={agent.id}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <Skeleton className="h-3 w-24 rounded-md" />
                          <Skeleton className="h-3 w-16 rounded-md" />
                        </div>
                        <Skeleton className="h-1 w-full rounded-full" />
                      </div>
                    );
                  }
                  return status && hasUsageData(status) ? (
                    <ProviderUsageRow
                      agent={agent}
                      key={agent.id}
                      status={status}
                    />
                  ) : null;
                })}
              </div>
            </section>
          ) : null}
        </header>

        <div
          aria-label="Workspace results"
          className="min-h-0 flex-1 overflow-y-auto p-2"
          role="listbox"
        >
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading workspaces…
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <p className="text-sm font-medium">Could not load workspaces</p>
              <button
                className="rounded-lg bg-muted px-3 py-1.5 text-xs font-medium hover:bg-accent"
                onClick={() => void refresh()}
                type="button"
              >
                Try again
              </button>
            </div>
          ) : visibleWorkspaces.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {workspaces.length === 0
                ? "No workspaces yet"
                : "No matching workspaces"}
            </div>
          ) : (
            visibleWorkspaces.map((workspace, index) => (
              <TrayWorkspaceRow
                key={workspace.id}
                workspace={workspace}
                selected={index === selectedIndex}
                expanded={expandedWorkspaceIds.has(workspace.id)}
                onToggleExpanded={() => toggleWorkspaceExpanded(workspace.id)}
                onOpen={() => openWorkspace(workspace.id)}
                onHover={() => setSelectedIndex(index)}
              />
            ))
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{workspaces.length} workspaces</span>
            <button
              type="button"
              onClick={() => void togglePreventSleep()}
              className={cn(
                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                preventSleep
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold"
                  : "hover:bg-muted hover:text-foreground",
              )}
              title={
                preventSleep
                  ? "Prevent sleep is active (click to allow sleep)"
                  : "Click to prevent computer from sleeping"
              }
            >
              <span className="inline-flex items-center gap-1">
                <HugeiconsIcon
                  icon={preventSleep ? Coffee02Icon : Moon02Icon}
                  size={11}
                  strokeWidth={2}
                />
                {preventSleep ? "Awake" : "Sleep"}
              </span>
            </button>
          </div>
          <span>↑↓ Select · ↵ Open · esc Close</span>
        </footer>
      </section>
    </main>
  );
}

function ProviderUsageRow({
  agent,
  status,
}: {
  agent: CliAgentDefinition;
  status: ProviderLimitStatus;
}) {
  const summary = summarizeUsage(status);
  if (!summary) return null;
  const usedPercent =
    summary.usedPercent === undefined
      ? undefined
      : Math.min(100, Math.max(0, summary.usedPercent));
  const tone =
    usedPercent === undefined ? null : usagePercentTone(usedPercent);

  return (
    <div className="space-y-1.5">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <AgentCliIcon agent={agent.id} size="sm" />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {agent.name}
        </span>
        <span
          className={cn(
            "shrink-0 font-mono",
            tone ? USAGE_TEXT_TONE_CLASS[tone] : "text-muted-foreground",
          )}
        >
          {summary.value}
        </span>
      </div>
      {usedPercent !== undefined && tone ? (
        <div
          aria-label={`${agent.name} ${usedPercent}% used`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={usedPercent}
          className="h-0.5 overflow-hidden rounded-full bg-border/60"
          role="progressbar"
        >
          <div
            className={`h-full rounded-full ${USAGE_BAR_TONE_CLASS[tone]}`}
            style={{ width: `${usedPercent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function summarizeUsage(
  status: ProviderLimitStatus,
): { value: string; usedPercent?: number } | null {
  const accountPercent = status.accountUsage?.usedPercent;
  if (accountPercent !== undefined) {
    return { value: `${accountPercent}% used`, usedPercent: accountPercent };
  }

  const limit = status.rateLimits[0];
  if (limit) {
    const window = limit.windowMinutes
      ? ` / ${formatUsageWindow(limit.windowMinutes)}`
      : "";
    const resetWeekday = formatResetWeekday(limit.resetsAt);
    return {
      value: `${limit.usedPercent}%${window}${resetWeekday ? ` · ${resetWeekday}` : ""}`,
      usedPercent: limit.usedPercent,
    };
  }

  if (status.sessionUsage) {
    return {
      value: formatTokens(
        status.sessionUsage.inputTokens + status.sessionUsage.outputTokens,
      ),
    };
  }
  return null;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M tokens`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K tokens`;
  return `${tokens} tokens`;
}

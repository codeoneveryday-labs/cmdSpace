import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import {
  getEnabledCliAgentDefinitions,
  type CliAgentDefinition,
} from "@/modules/terminal/lib/cliAgents";
import { loadPreferences } from "@/modules/settings/store";
import {
  ArrowDown01Icon,
  CanvasIcon,
  ComputerTerminal02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clampSelectionIndex,
  filterTrayWorkspaces,
  type TrayTerminal,
  type TrayWorkspace,
} from "./workspaces";

type ProviderLimitStatus = {
  provider: string;
  rateLimits: Array<{
    label: string;
    usedPercent: number;
    windowMinutes?: number;
  }>;
  accountUsage?: {
    plan?: string;
    usedPercent?: number;
  };
  sessionUsage?: {
    inputTokens: number;
    outputTokens: number;
  };
};

function workspaceSubtitle(workspace: TrayWorkspace): string {
  if (workspace.workingFolder) return workspace.workingFolder;
  if (workspace.workspaceMode === "agent") return "Agent chat workspace";
  return workspace.workspaceMode === "canvas"
    ? "Canvas workspace"
    : "Terminal workspace";
}

type TrayPane = {
  paneIndex: number;
  lastCommand?: string | null;
  autoLaunch?: boolean;
};

async function loadTrayTerminals(workspace: TrayWorkspace): Promise<TrayTerminal[]> {
  if (workspace.workspaceMode === "agent") {
    return [{ label: "Agent chat" }];
  }

  if (workspace.workspaceMode === "canvas" && workspace.paneLayout) {
    try {
      const diagram = JSON.parse(workspace.paneLayout) as {
        nodes?: Array<{ kind?: string; label?: string }>;
      };
      const terminals = (diagram.nodes ?? [])
        .filter((node) => node.kind === "terminal")
        .map((node, index) => ({ label: node.label?.trim() || `Terminal ${index + 1}` }));
      if (terminals.length > 0) return terminals;
    } catch {
      // Fall through to persisted pane rows/count for older canvas layouts.
    }
  }

  try {
    const panes = await invoke<TrayPane[]>("db_list_panes", {
      workspaceId: workspace.id,
    });
    if (panes.length > 0) {
      return panes
        .sort((left, right) => left.paneIndex - right.paneIndex)
        .map((pane, index) => ({
          label:
            pane.autoLaunch && pane.lastCommand?.trim()
              ? pane.lastCommand.trim()
              : `Terminal ${index + 1}`,
        }));
    }
  } catch {
    // The popup can still show count-based placeholders when DB pane rows are absent.
  }

  return Array.from({ length: Math.max(0, workspace.count) }, (_, index) => ({
    label: `Terminal ${index + 1}`,
  }));
}

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<TrayWorkspace[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usageAgents, setUsageAgents] = useState<CliAgentDefinition[]>([]);
  const [statuses, setStatuses] = useState<ProviderLimitStatus[]>([]);
  const [pendingProviders, setPendingProviders] = useState<Set<string>>(
    () => new Set(),
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const usageRequestId = useRef(0);

  const visibleWorkspaces = useMemo(
    () => filterTrayWorkspaces(workspaces, query),
    [query, workspaces],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await invoke<TrayWorkspace[]>("db_list_workspaces");
      const hydrated = await Promise.all(
        next.map(async (workspace) => ({
          ...workspace,
          terminals: await loadTrayTerminals(workspace),
        })),
      );
      setWorkspaces(hydrated);
      setExpandedWorkspaceIds(new Set(hydrated.map((workspace) => workspace.id)));
      setSelectedIndex(hydrated.length > 0 ? 0 : -1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUsage = useCallback(async () => {
    const requestId = ++usageRequestId.current;
    let agents: CliAgentDefinition[];
    try {
      const preferences = await loadPreferences();
      agents = getEnabledCliAgentDefinitions(
        preferences.cliAgentIds,
        preferences.disabledCliAgentIds,
      );
    } catch {
      if (requestId === usageRequestId.current) {
        setUsageAgents([]);
        setPendingProviders(new Set());
      }
      return;
    }
    if (requestId !== usageRequestId.current) return;

    const enabledIds = new Set<string>(agents.map((agent) => agent.id));
    setUsageAgents(agents);
    setStatuses((current) =>
      current.filter((status) => enabledIds.has(status.provider)),
    );
    setPendingProviders(enabledIds);

    await Promise.allSettled(
      agents.map(async (agent) => {
        try {
          const status = await invoke<ProviderLimitStatus | null>(
            "provider_limit_status",
            { provider: agent.id },
          );
          if (requestId === usageRequestId.current) {
            setStatuses((current) => {
              const others = current.filter(
                (item) => item.provider !== agent.id,
              );
              return status ? [...others, status] : others;
            });
          }
        } finally {
          if (requestId === usageRequestId.current) {
            setPendingProviders((current) => {
              const next = new Set(current);
              next.delete(agent.id);
              return next;
            });
          }
        }
      }),
    );
  }, []);

  const visibleUsage = useMemo(
    () =>
      usageAgents.flatMap((agent) => {
        const status = statuses.find((item) => item.provider === agent.id);
        return status && hasUsageData(status) ? [{ agent, status }] : [];
      }),
    [statuses, usageAgents],
  );
  const hasPendingUsage = usageAgents.some(
    (agent) =>
      pendingProviders.has(agent.id) &&
      !statuses.some((status) => status.provider === agent.id),
  );

  const hide = useCallback(() => {
    void invoke("hide_workspace_switcher");
  }, []);

  const openWorkspace = useCallback((workspaceId: string) => {
    void invoke("open_workspace_from_tray", { workspaceId });
  }, []);

  useEffect(() => {
    void refresh();
    void refreshUsage();
    const unlistenOpen = listen("cmdspace:tray-opened", () => {
      setQuery("");
      setSelectedIndex(0);
      void refresh();
      void refreshUsage();
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
  }, [hide, refresh, refreshUsage]);

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
            visibleWorkspaces.map((workspace, index) => {
              const canvas = workspace.workspaceMode === "canvas";
              const selected = index === selectedIndex;
              return (
                <div key={workspace.id} className="space-y-0.5">
                <button
                  key={workspace.id}
                  aria-selected={selected}
                  className={cn(
                    "group flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors",
                    selected
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/70 focus-visible:bg-muted/70",
                  )}
                  onClick={() => openWorkspace(workspace.id)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  role="option"
                  type="button"
                >
                  <span
                    className="flex size-5 shrink-0 items-center justify-center text-muted-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleWorkspaceExpanded(workspace.id);
                    }}
                    aria-hidden="true"
                  >
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      size={14}
                      strokeWidth={2}
                      className={cn("transition-transform", !expandedWorkspaceIds.has(workspace.id) && "-rotate-90")}
                    />
                  </span>
                  <span
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm ring-1 ring-border/70"
                    style={{ color: workspace.accentColor ?? undefined }}
                  >
                    <HugeiconsIcon
                      icon={canvas ? CanvasIcon : ComputerTerminal02Icon}
                      size={18}
                      strokeWidth={1.8}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {workspace.name}
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
                {expandedWorkspaceIds.has(workspace.id) ? (
                  <div className="ml-5 space-y-0.5 border-l border-border/60 pl-2">
                    {(workspace.terminals ?? []).map((terminal) => (
                      <button
                        key={terminal.label}
                        type="button"
                        onClick={() => openWorkspace(workspace.id)}
                        className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                      >
                        <HugeiconsIcon icon={ComputerTerminal02Icon} size={14} strokeWidth={1.8} />
                        <span className="truncate">{terminal.label}</span>
                      </button>
                    ))}
                    {(workspace.terminals ?? []).length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No terminals open
                      </div>
                    ) : null}
                  </div>
                ) : null}
                </div>
              );
            })
          )}
        </div>

        <footer className="flex items-center justify-between border-t border-border/70 px-4 py-2 text-[11px] text-muted-foreground">
          <span>{workspaces.length} workspaces</span>
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

  return (
    <div className="space-y-1.5">
      <div className="flex min-w-0 items-center gap-2 text-xs">
        <AgentCliIcon agent={agent.id} size="sm" />
        <span className="min-w-0 flex-1 truncate font-medium text-foreground">
          {agent.name}
        </span>
        <span className="shrink-0 font-mono text-muted-foreground">
          {summary.value}
        </span>
      </div>
      {usedPercent !== undefined ? (
        <div
          aria-label={`${agent.name} ${usedPercent}% used`}
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={usedPercent}
          className="h-0.5 overflow-hidden rounded-full bg-border/60"
          role="progressbar"
        >
          <div
            className="h-full rounded-full bg-foreground/70"
            style={{ width: `${usedPercent}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function hasUsageData(status: ProviderLimitStatus): boolean {
  return Boolean(
    status.accountUsage || status.rateLimits.length > 0 || status.sessionUsage,
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
    return {
      value: `${limit.usedPercent}%${window}`,
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

function formatUsageWindow(minutes: number): string {
  if (minutes % (60 * 24) === 0) return `${minutes / (60 * 24)}d`;
  if (minutes % 60 === 0) return `${minutes / 60}h`;
  return `${minutes}m`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M tokens`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K tokens`;
  return `${tokens} tokens`;
}

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import {
  CLI_AGENT_BY_ID,
  getEnabledCliAgentDefinitions,
} from "@/modules/terminal/lib/cliAgents";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { invoke } from "@tauri-apps/api/core";
import {
  Refresh01Icon,
  Search01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  filterImportableSessions,
  formatRelativeActivity,
  sessionProviderCounts,
  sessionsForEnabledProviders,
  sessionsForWorkspace,
  type AgentSessionProvider,
  type ImportableAgentSession,
} from "./lib/importSessions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceName: string | null;
  workspaceCwd: string | null;
  actionLabel?: string;
  multiple?: boolean;
  onImport: (session: ImportableAgentSession) => Promise<boolean>;
  onImportMany?: (sessions: ImportableAgentSession[]) => Promise<boolean>;
};

export function ImportSessionDialog({
  open,
  onOpenChange,
  workspaceName,
  workspaceCwd,
  actionLabel = "Resume",
  multiple = false,
  onImport,
  onImportMany,
}: Props) {
  const [sessions, setSessions] = useState<ImportableAgentSession[]>([]);
  const configuredCliAgentIds = usePreferencesStore((state) => state.cliAgentIds);
  const disabledCliAgentIds = usePreferencesStore(
    (state) => state.disabledCliAgentIds,
  );
  const [scope, setScope] = useState<"workspace" | "all">("workspace");
  const [provider, setProvider] = useState<AgentSessionProvider | "all">(
    "all",
  );
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [selectedSessionKeys, setSelectedSessionKeys] = useState<Set<string>>(
    new Set(),
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const found = await invoke<ImportableAgentSession[]>(
        "list_agent_sessions",
        { limit: 200, workspaceCwd },
      );
      setSessions(sessionsForWorkspace(found, workspaceCwd));
    } catch (reason) {
      setError(String(reason));
    } finally {
      setLoading(false);
    }
  }, [workspaceCwd]);

  useEffect(() => {
    if (!open) return;
    setScope("workspace");
    setProvider("all");
    setQuery("");
    setImporting(null);
    setSelectedSessionKeys(new Set());
    void load();
  }, [load, open]);

  const enabledProviders = useMemo(
    () =>
      getEnabledCliAgentDefinitions(
        configuredCliAgentIds,
        disabledCliAgentIds,
      ).map((agent) => agent.id),
    [configuredCliAgentIds, disabledCliAgentIds],
  );
  const enabledSessions = useMemo(
    () => sessionsForEnabledProviders(sessions, enabledProviders),
    [enabledProviders, sessions],
  );

  useEffect(() => {
    if (provider !== "all" && !enabledProviders.includes(provider)) {
      setProvider("all");
    }
  }, [enabledProviders, provider]);

  const scopedSessions = useMemo(
    () =>
      filterImportableSessions(
        enabledSessions,
        workspaceCwd,
        scope,
        "all",
        "",
      ),
    [enabledSessions, scope, workspaceCwd],
  );
  const providerOptions = useMemo(
    () => sessionProviderCounts(scopedSessions, enabledProviders),
    [enabledProviders, scopedSessions],
  );
  const visibleSessions = useMemo(
    () =>
      filterImportableSessions(
        enabledSessions,
        workspaceCwd,
        scope,
        provider,
        query,
      ),
    [enabledSessions, provider, query, scope, workspaceCwd],
  );

  const selectedSessions = useMemo(
    () =>
      enabledSessions.filter((session) =>
        selectedSessionKeys.has(`${session.provider}:${session.sessionId}`),
      ),
    [enabledSessions, selectedSessionKeys],
  );
  const selectedSessionLabel =
    selectedSessions.length === 1 ? "session" : "sessions";

  const importSession = async (session: ImportableAgentSession) => {
    if (session.active) return;
    const key = `${session.provider}:${session.sessionId}`;
    setImporting(key);
    setError(null);
    try {
      if (await onImport(session)) onOpenChange(false);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setImporting(null);
    }
  };

  const toggleSession = (session: ImportableAgentSession) => {
    if (session.active) return;
    const key = `${session.provider}:${session.sessionId}`;
    setSelectedSessionKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const importSelectedSessions = async () => {
    if (!onImportMany || selectedSessions.length === 0) return;
    setImporting("batch");
    setError(null);
    try {
      if (await onImportMany(selectedSessions)) onOpenChange(false);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setImporting(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[78vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import agent session</DialogTitle>
          <DialogDescription>
            Resume a native CLI session in a new terminal in {workspaceName ?? "this workspace"}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={scope === "workspace" ? "default" : "outline"}
            onClick={() => {
              setScope("workspace");
              setProvider("all");
            }}
          >
            Current workspace
          </Button>
          <Button
            size="sm"
            variant={scope === "all" ? "default" : "outline"}
            onClick={() => {
              setScope("all");
              setProvider("all");
            }}
          >
            All sessions
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto size-8"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh sessions"
          >
            <HugeiconsIcon icon={Refresh01Icon} size={15} strokeWidth={2} />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <HugeiconsIcon
              icon={Search01Icon}
              size={15}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search sessions"
              className="pl-9"
              autoFocus
            />
          </div>
          <Select
            value={provider}
            onValueChange={(value) =>
              setProvider(value as AgentSessionProvider | "all")
            }
          >
            <SelectTrigger
              size="sm"
              className="h-9 max-w-48 shrink-0 rounded-lg border-border/70 bg-background"
              aria-label="Filter sessions by agent"
            >
              <SelectValue>
                <span className="truncate">
                  {provider === "all"
                    ? "All agents"
                    : CLI_AGENT_BY_ID[provider].name}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" align="end">
              <SelectItem value="all">All agents</SelectItem>
              {providerOptions.map(({ provider: option, count }) => (
                <SelectItem key={option} value={option}>
                  <AgentCliIcon agent={option} />
                  <span>{CLI_AGENT_BY_ID[option].name}</span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        ) : null}

        <div className="min-h-48 flex-1 overflow-y-auto rounded-lg border border-border/70">
          {loading ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Scanning native CLI sessions…
            </div>
          ) : visibleSessions.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
              <span>
                {provider !== "all"
                  ? `No ${CLI_AGENT_BY_ID[provider].name} sessions found${scope === "workspace" ? " for this workspace" : ""}.`
                  : scope === "workspace"
                    ? "No sessions found for this workspace."
                    : "No native CLI sessions found."}
              </span>
              {scope === "workspace" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setScope("all");
                    setProvider("all");
                  }}
                >
                  Show all sessions
                </Button>
              ) : null}
            </div>
          ) : (
            visibleSessions.map((session) => {
              const key = `${session.provider}:${session.sessionId}`;
              const selected = selectedSessionKeys.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  className={`flex w-full items-start gap-3 border-b border-border/60 px-3 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 disabled:opacity-60 ${selected ? "bg-accent/70" : ""}`}
                  disabled={importing !== null || session.active}
                  aria-pressed={selected}
                  onClick={() =>
                    multiple
                      ? toggleSession(session)
                      : void importSession(session)
                  }
                >
                  {multiple ? (
                    <span
                      className={`mt-2 flex size-4 shrink-0 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                      aria-hidden="true"
                    >
                      {selected ? (
                        <HugeiconsIcon icon={Tick02Icon} size={12} strokeWidth={2.5} />
                      ) : null}
                    </span>
                  ) : null}
                  <span className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-foreground/[0.06]">
                    <AgentCliIcon agent={session.provider} size="md" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span
                        className="truncate text-sm font-medium"
                        title={session.title}
                      >
                        {session.title}
                      </span>
                      <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {session.provider}
                      </span>
                    </span>
                    {session.preview ? (
                      <span
                        className="mt-0.5 block truncate text-xs text-muted-foreground"
                        title={session.preview ?? undefined}
                      >
                        {session.preview}
                      </span>
                    ) : null}
                    <span
                      className="mt-1 block truncate text-[11px] text-muted-foreground/80"
                      title={session.cwd}
                    >
                      {session.cwd}
                    </span>
                  </span>
                  <span className="mt-0.5 flex shrink-0 flex-col items-end gap-1 text-right">
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {formatRelativeActivity(session.lastActivityAt)}
                    </span>
                    <span className="text-[11px] font-medium text-primary">
                      {session.active
                        ? "Active in another Codex window"
                        : multiple
                          ? selected
                            ? "Selected"
                            : null
                        : importing === key
                          ? "Importing…"
                          : actionLabel}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        {multiple ? (
          <div className="flex items-center justify-between gap-3 border-t border-border/40 pt-3">
            <span className="text-xs text-muted-foreground">
              {selectedSessions.length} selected
            </span>
            <Button
              type="button"
              disabled={selectedSessions.length === 0 || importing !== null}
              onClick={() => void importSelectedSessions()}
            >
              {importing === "batch"
                ? "Adding sessions…"
                : `Add ${selectedSessions.length} ${selectedSessionLabel}`}
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import {
  CLI_AGENT_CATALOG,
  filterCliAgentCatalog,
  normalizeCliAgentIds,
  type CliAgent,
  type CliAgentCatalogEntry,
} from "@/modules/terminal/lib/cliAgents";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  setCliAgentIds,
  setDisabledCliAgentIds,
} from "@/modules/settings/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  LinkSquare02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SectionHeader } from "../components/SectionHeader";
import { checkInstalledCliAgents } from "./cliAgentScan";

type ScanState = "scanning" | "ready" | "error";

export function CliAgentsSection() {
  const configuredIds = usePreferencesStore((state) => state.cliAgentIds);
  const disabledIds = usePreferencesStore(
    (state) => state.disabledCliAgentIds,
  );
  const [query, setQuery] = useState("");
  const [installedIds, setInstalledIds] = useState<Set<CliAgent>>(new Set());
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const mountedRef = useRef(true);
  const scanVersionRef = useRef(0);

  const configuredEntries = useMemo(() => {
    const configured = new Set(configuredIds);
    return CLI_AGENT_CATALOG.filter(({ id }) => configured.has(id));
  }, [configuredIds]);
  const catalogEntries = useMemo(
    () => filterCliAgentCatalog(configuredIds, query),
    [configuredIds, query],
  );
  const disabled = useMemo(() => new Set(disabledIds), [disabledIds]);

  const scanAgents = useCallback(async (forceRefresh = false) => {
    const scanVersion = ++scanVersionRef.current;
    const names = CLI_AGENT_CATALOG.map(({ executable }) => executable);
    setScanState("scanning");
    try {
      const present = await checkInstalledCliAgents(
        names,
        (agentNames) =>
          invoke<boolean[]>("check_agent_clis", {
            names: agentNames,
            workspace: null,
          }),
        forceRefresh,
      );
      if (!mountedRef.current || scanVersion !== scanVersionRef.current) return;
      setInstalledIds(
        new Set(
          CLI_AGENT_CATALOG.filter((_, index) => present[index]).map(
            ({ id }) => id,
          ),
        ),
      );
      setScanState("ready");
    } catch (error) {
      console.error("Failed to check installed agent CLIs:", error);
      if (mountedRef.current && scanVersion === scanVersionRef.current) {
        setScanState("error");
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void scanAgents();
    return () => {
      mountedRef.current = false;
    };
  }, [scanAgents]);

  const addAgent = async (id: CliAgent) => {
    const nextConfigured = normalizeCliAgentIds([...configuredIds, id]);
    const nextDisabled = disabledIds.filter((candidate) => candidate !== id);
    await setCliAgentIds(nextConfigured);
    await setDisabledCliAgentIds(nextDisabled);
  };

  const setAgentEnabled = async (id: CliAgent, enabled: boolean) => {
    if (!installedIds.has(id)) return;
    const nextDisabled = enabled
      ? disabledIds.filter((candidate) => candidate !== id)
      : normalizeCliAgentIds([...disabledIds, id]);
    await setDisabledCliAgentIds(nextDisabled);
  };

  return (
    <div className="flex flex-col gap-7">
      <SectionHeader
        title="CLI Agents"
        description="Choose the coding agents available when you create a workspace. Add registers an agent with cmdSpace; installation stays under your control."
      />

      <section className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-[12.5px] font-medium">Configured agents</h2>
            <p className="text-[10.5px] text-muted-foreground">
              Enabled agents appear in Workspace Setup.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10.5px] text-muted-foreground">
              {configuredEntries.length} configured
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={scanState === "scanning"}
              onClick={() => void scanAgents(true)}
            >
              {scanState === "scanning" ? "Checking…" : "Refresh"}
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/60 bg-card/40">
          {configuredEntries.map((entry, index) => (
            <ConfiguredAgentRow
              key={entry.id}
              entry={entry}
              enabled={!disabled.has(entry.id)}
              installed={installedIds.has(entry.id)}
              scanState={scanState}
              first={index === 0}
              onEnabledChange={(enabled) =>
                void setAgentEnabled(entry.id, enabled)
              }
            />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h2 className="text-[12.5px] font-medium">Add CLI agent</h2>
          <p className="text-[10.5px] text-muted-foreground">
            Search the supported catalog and add agents to cmdSpace.
          </p>
        </div>

        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            size={14}
            strokeWidth={1.75}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search CLI agents"
            aria-label="Search CLI agents"
            className="h-9 pl-9 text-[12px]"
          />
        </div>

        {catalogEntries.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-border/60 bg-card/40">
            {catalogEntries.map((entry, index) => (
              <CatalogAgentRow
                key={entry.id}
                entry={entry}
                first={index === 0}
                onAdd={() => void addAgent(entry.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 bg-card/25 px-4 py-8 text-center text-[11px] text-muted-foreground">
            {query.trim()
              ? "No CLI agents match your search."
              : "All supported CLI agents have been added."}
          </div>
        )}
      </section>
    </div>
  );
}

function ConfiguredAgentRow({
  entry,
  enabled,
  installed,
  scanState,
  first,
  onEnabledChange,
}: {
  entry: CliAgentCatalogEntry;
  enabled: boolean;
  installed: boolean;
  scanState: ScanState;
  first: boolean;
  onEnabledChange: (enabled: boolean) => void;
}) {
  const status =
    scanState === "scanning"
      ? { label: "Checking…", dot: "bg-muted-foreground/50" }
      : scanState === "error"
        ? { label: "Status unavailable", dot: "bg-muted-foreground/50" }
        : installed
          ? { label: "Available", dot: "bg-emerald-500" }
          : { label: "Not installed", dot: "bg-amber-500" };

  return (
    <div
      className={cn(
        "flex min-h-14 items-center gap-3 px-3 py-2.5",
        !first && "border-t border-border/55",
      )}
    >
      <AgentCliIcon agent={entry.id} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12.5px] font-medium">
            {entry.name}
          </span>
          {scanState === "scanning" ? (
            <span
              aria-label="Checking CLI availability"
              className="ml-1 h-3 w-14 shrink-0 animate-pulse rounded-full bg-muted"
            />
          ) : (
            <>
              <span className="text-[10px] text-muted-foreground">·</span>
              <span className={cn("size-1.5 shrink-0 rounded-full", status.dot)} />
              <span className="truncate text-[10.5px] text-muted-foreground">
                {status.label}
              </span>
            </>
          )}
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <code className="truncate font-mono text-[9.5px] text-muted-foreground/80">
            {entry.executable}
          </code>
          {scanState === "ready" && !installed && entry.installUrl ? (
            <InstallLink entry={entry} />
          ) : null}
        </div>
      </div>
      <Switch
        size="sm"
        checked={enabled}
        disabled={scanState !== "ready" || !installed}
        onCheckedChange={onEnabledChange}
        aria-label={
          installed
            ? `${enabled ? "Disable" : "Enable"} ${entry.name}`
            : `${entry.name} is not installed`
        }
        title={installed ? undefined : "Install this CLI before enabling it"}
      />
    </div>
  );
}

function CatalogAgentRow({
  entry,
  first,
  onAdd,
}: {
  entry: CliAgentCatalogEntry;
  first: boolean;
  onAdd: () => void;
}) {
  return (
    <div
      className={cn(
        "flex min-h-16 items-center gap-3 px-3 py-2.5",
        !first && "border-t border-border/55",
      )}
    >
      <AgentCliIcon agent={entry.id} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[12.5px] font-medium">
            {entry.name}
          </span>
          <code className="shrink-0 font-mono text-[9.5px] text-muted-foreground">
            {entry.executable}
          </code>
        </div>
        <p className="truncate text-[10.5px] text-muted-foreground">
          {entry.description}
        </p>
        {entry.installUrl ? <InstallLink entry={entry} /> : null}
      </div>
      <Button size="sm" className="h-7 min-w-16 text-[11px]" onClick={onAdd}>
        Add
      </Button>
    </div>
  );
}

function InstallLink({ entry }: { entry: CliAgentCatalogEntry }) {
  if (!entry.installUrl) return null;
  return (
    <button
      type="button"
      onClick={() => void openUrl(entry.installUrl!)}
      className="inline-flex items-center gap-1 text-[9.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      aria-label={`Open installation instructions for ${entry.name}`}
    >
      Install instructions
      <HugeiconsIcon icon={LinkSquare02Icon} size={10} strokeWidth={1.75} />
    </button>
  );
}

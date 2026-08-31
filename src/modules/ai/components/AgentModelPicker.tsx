import { useState } from "react";
import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import { CLI_AGENT_BY_ID, type CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { AgentChatModelOption } from "@/modules/ai/lib/agentChatRuntime";
import {
  Cancel01Icon,
  Refresh01Icon,
  Search01Icon,
  Tick02Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function AgentModelPicker({
  agent,
  selectedModel,
  models,
  isLoading,
  modelsError,
  onRefresh,
  onOpen,
  onSelect,
}: {
  agent: CliAgent;
  selectedModel: string;
  models: AgentChatModelOption[];
  isLoading: boolean;
  modelsError?: string | null;
  onRefresh: () => void;
  onOpen: () => void;
  onSelect: (model: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const definition = CLI_AGENT_BY_ID[agent];
  const filtered = models.filter((model) =>
    `${model.id} ${model.label} ${model.description ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const selected = models.find((model) => model.id === selectedModel);
  const label = selected?.label || selectedModel || (isLoading ? "Loading models…" : "Default model");

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) onOpen(); }}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex h-8 min-w-0 max-w-52 items-center gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label={`Model: ${label}`}>
          <AgentCliIcon agent={agent} size="md" />
          <span className="truncate">{isLoading ? "Loading models…" : label}</span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={13} strokeWidth={1.8} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-[360px] gap-0 overflow-hidden rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2"><AgentCliIcon agent={agent} size="md" /><span className="truncate text-sm font-medium">{definition.name}</span></div>
          <button type="button" onClick={() => setOpen(false)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground" aria-label="Close model picker"><HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.8} /></button>
        </div>
        <label className="relative block border-b border-border/60 px-4 py-3"><HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models..." aria-label="Search models" className="h-8 w-full bg-transparent pl-7 text-sm text-foreground outline-none placeholder:text-muted-foreground" /></label>
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 text-xs font-medium text-muted-foreground"><span>Discovered</span><span className="tabular-nums">{filtered.length}</span></div>
        <div className="max-h-64 overflow-y-auto p-2">
          {isLoading ? <p className="px-3 py-3 text-xs text-muted-foreground">Loading models from {definition.name}…</p> : null}
          {filtered.map((model) => {
            const isSelected = model.id === selectedModel;
            return <button key={model.id} type="button" onClick={() => { onSelect(model.id); setOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.06]"><AgentCliIcon agent={agent} size="md" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{model.id === "default" ? definition.name : model.label}</span>{model.description ? <span className="block truncate text-xs text-muted-foreground">{model.description}</span> : null}</span>{isSelected ? <HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2.2} className="shrink-0 text-emerald-500" /> : null}</button>;
          })}
          {filtered.length === 0 ? <p className="px-3 py-4 text-xs text-muted-foreground">{modelsError ?? "No models returned by this CLI"}</p> : null}
        </div>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3"><span className="text-xs text-muted-foreground">Updated just now</span><button type="button" onClick={onRefresh} disabled={isLoading} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50" aria-label="Refresh models"><HugeiconsIcon icon={Refresh01Icon} size={14} strokeWidth={2} />Refresh</button></div>
      </PopoverContent>
    </Popover>
  );
}

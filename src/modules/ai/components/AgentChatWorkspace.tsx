import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import { AgentStateDot } from "@/modules/terminal/AgentStateDot";
import { CLI_AGENT_BY_ID, type CliAgent } from "@/modules/terminal/lib/cliAgents";
import {
  getAgentUsageStatuses,
  type AgentUsageStatus,
} from "@/modules/terminal/lib/terminal-native";
import { useAgentChatSession } from "@/modules/ai/hooks/useAgentChatSession";
import { useWhisperRecording } from "@/modules/ai/hooks/useWhisperRecording";
import type { ProviderKeys } from "@/modules/ai/lib/keyring";
import { listAgentChatModels, listAgentChatSlashOptions, loadAgentChatConfig, loadAgentModelCache, saveAgentChatConfig, saveAgentModelCache, type AgentChatModelOption } from "@/modules/ai/lib/agentChatRuntime";
import {
  buildAgentChatForkHistory,
  buildAgentChatOutlineItems,
  type AgentChatHistoryAttachment,
} from "@/modules/ai/lib/agentChatTimeline";
import { usePreferencesStore } from "@/modules/settings/preferences";
import {
  Add01Icon,
  AiChat01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Attachment01Icon,
  Brain02Icon,
  Cancel01Icon,
  GithubIcon,
  ImageAdd01Icon,
  FlashIcon,
  CheckListIcon,
  Search01Icon,
  ShieldBanIcon,
  Tick02Icon,
  Refresh01Icon,
  Mic01Icon,
  Copy01Icon,
  GitForkIcon,
  Edit01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import { MarkdownCode } from "@/components/ai-elements/markdown-code";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const markdownComponents = { code: MarkdownCode };
const MAX_OUTLINE_LINES = 80;

function formatTokenCount(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}m`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return Math.round(value).toString();
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

function formatWorkedDuration(milliseconds: number | undefined): string {
  const seconds = Math.max(1, Math.round((milliseconds ?? 0) / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function ContextWindowMeter({ usage }: { usage: AgentUsageStatus | null }) {
  const contextWindow = usage?.contextWindow;
  const contextTokens = usage?.contextTokens;
  const percentage = contextWindow && contextTokens !== undefined
    ? Math.min(100, Math.max(0, (contextTokens / contextWindow) * 100))
    : null;
  const circumference = 2 * Math.PI * 8;
  const dashOffset = percentage === null ? circumference : circumference * (1 - percentage / 100);
  const color = percentage !== null && percentage > 90
    ? "rgb(239 68 68)"
    : percentage !== null && percentage >= 70
      ? "rgb(245 158 11)"
      : "currentColor";
  const title = percentage === null
    ? "Context window unavailable from this CLI"
    : `Context window: ${formatTokenCount(contextTokens!)} of ${formatTokenCount(contextWindow!)} tokens${usage?.contextIsEstimated ? " (estimated)" : ""}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={title}
        >
          <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true" className="-rotate-90">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.22" />
            <circle
              cx="10"
              cy="10"
              r="8"
              fill="none"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dashoffset,stroke] duration-300"
            />
          </svg>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className="block min-w-44 px-3 py-2 text-[11px] leading-5">
        <p className="font-medium">Context window</p>
        {percentage === null ? (
          <p className="text-background/70">Unavailable from this CLI</p>
        ) : (
          <>
            <p>{Math.round(percentage)}% used</p>
            <p className="text-background/70">{formatTokenCount(contextTokens!)} / {formatTokenCount(contextWindow!)} tokens{usage?.contextIsEstimated ? " · estimated" : ""}</p>
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

function VoiceLevelMeter({ audioLevel, active }: { audioLevel: number; active: boolean }) {
  const bars = [0.48, 0.76, 1, 0.76, 0.48];
  return (
    <span className="flex size-8 items-center justify-center gap-0.5 text-muted-foreground" aria-hidden="true">
      {bars.map((weight, index) => (
        <span
          key={index}
          className="w-0.5 rounded-full bg-current transition-transform duration-75"
          style={{
            height: `${7 + (index % 3) * 3}px`,
            transform: `scaleY(${active ? 0.28 + audioLevel * 0.72 * weight : 0.42})`,
            opacity: active ? 1 : 0.6,
          }}
        />
      ))}
    </span>
  );
}

function ChatHistoryCard({ attachment }: { attachment: AgentChatHistoryAttachment }) {
  return <span className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/55 px-2.5 py-2 text-left"><HugeiconsIcon icon={AiChat01Icon} size={15} strokeWidth={1.8} className="text-muted-foreground" /><span><span className="block text-xs font-medium text-foreground">{attachment.title}</span><span className="block text-[11px] text-muted-foreground">{attachment.subtitle}</span></span></span>;
}

function UserPrompt({
  item,
  canEdit,
  onEdit,
}: {
  item: Extract<import("@/modules/ai/lib/agentChatTimeline").AgentChatTimelineItem, { kind: "user" }>;
  canEdit: boolean;
  onEdit: (text: string) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.text);
  const [copied, setCopied] = useState(false);
  const time = item.sentAt ? new Date(item.sentAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null;
  if (editing) return <div className="flex justify-end"><div className="w-full max-w-[85%] rounded-3xl bg-foreground/10 p-3"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} className="w-full resize-none bg-transparent text-sm leading-6 text-foreground outline-none" autoFocus /><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => { setDraft(item.text); setEditing(false); }} className="rounded-xl border border-border px-3 py-1.5 text-sm">Cancel</button><button type="button" onClick={() => void onEdit(draft).then(() => setEditing(false))} disabled={!draft.trim()} className="rounded-xl bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-40">Send</button></div></div></div>;
  return <div className="group flex justify-end"><div className="max-w-[85%]"><div className="rounded-2xl rounded-br-md bg-foreground px-3.5 py-2.5 text-sm leading-6 text-background">{item.attachments?.length ? <div className="mb-2 flex flex-wrap gap-1.5">{item.attachments.map((attachment, index) => <ChatHistoryCard key={`${attachment.kind}-${index}`} attachment={attachment} />)}</div> : null}<p>{item.text}</p></div><div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">{time ? <span>{time}</span> : null}<button type="button" aria-label="Copy prompt" onClick={() => void navigator.clipboard.writeText(item.text).then(() => setCopied(true)).catch(() => undefined)} className="flex size-7 items-center justify-center rounded-md hover:bg-foreground/[0.07]" title={copied ? "Copied" : "Copy prompt"}><HugeiconsIcon icon={Copy01Icon} size={15} strokeWidth={1.8} /></button>{canEdit ? <button type="button" aria-label="Edit prompt" onClick={() => setEditing(true)} className="flex size-7 items-center justify-center rounded-md hover:bg-foreground/[0.07]" title="Edit prompt"><HugeiconsIcon icon={Edit01Icon} size={15} strokeWidth={1.8} /></button> : null}</div></div></div>;
}

function AssistantResponseActions({ text, workedMs, onFork }: { text: string; workedMs?: number; onFork: (destination: "tab" | "workspace") => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setCopied(false);
    }
  };
  return <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
    <button type="button" onClick={() => void copy()} aria-label="Copy response" className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"><HugeiconsIcon icon={Copy01Icon} size={15} strokeWidth={1.8} /><span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span></button>
    <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="Fork response" className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"><HugeiconsIcon icon={GitForkIcon} size={15} strokeWidth={1.8} /><span className="hidden sm:inline">Fork</span></button></DropdownMenuTrigger><DropdownMenuContent align="start" side="bottom" className="min-w-56"><DropdownMenuItem onSelect={() => onFork("tab")}><HugeiconsIcon icon={GitForkIcon} size={16} strokeWidth={1.8} />Fork in a new tab</DropdownMenuItem><DropdownMenuItem onSelect={() => onFork("workspace")}><HugeiconsIcon icon={GitForkIcon} size={16} strokeWidth={1.8} />Fork in a new workspace</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    <span className="hidden min-[380px]:inline text-muted-foreground/80">Worked for {formatWorkedDuration(workedMs)}</span>
  </div>;
}

type AgentAttachment = {
  label: string;
  context: string;
  kind: "image" | "file" | "url";
  previewUrl?: string;
};

function revokeAttachmentPreviews(attachments: AgentAttachment[]) {
  for (const attachment of attachments) {
    if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
  }
}

function ModelPicker({
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
        <button
          type="button"
          className="inline-flex h-8 min-w-0 max-w-52 items-center gap-1.5 rounded-full px-2.5 text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={`Model: ${label}`}
        >
          <AgentCliIcon agent={agent} size="md" />
          <span className="truncate">{isLoading ? "Loading models…" : label}</span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={13} strokeWidth={1.8} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-[360px] gap-0 overflow-hidden rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <AgentCliIcon agent={agent} size="md" />
            <span className="truncate text-sm font-medium">{definition.name}</span>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground" aria-label="Close model picker">
            <HugeiconsIcon icon={Cancel01Icon} size={18} strokeWidth={1.8} />
          </button>
        </div>
        <label className="relative block border-b border-border/60 px-4 py-3">
          <HugeiconsIcon icon={Search01Icon} size={16} strokeWidth={1.8} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search models..." aria-label="Search models" className="h-8 w-full bg-transparent pl-7 text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </label>
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 text-xs font-medium text-muted-foreground">
          <span>Discovered</span>
          <span className="tabular-nums">{filtered.length}</span>
        </div>
        <div className="max-h-64 overflow-y-auto p-2">
          {isLoading ? <p className="px-3 py-3 text-xs text-muted-foreground">Loading models from {definition.name}…</p> : null}
          {filtered.map((model) => {
            const selected = model.id === selectedModel;
            return (
              <button key={model.id} type="button" onClick={() => { onSelect(model.id); setOpen(false); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.06]">
                <AgentCliIcon agent={agent} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">{model.id === "default" ? definition.name : model.label}</span>
                  {model.description ? <span className="block truncate text-xs text-muted-foreground">{model.description}</span> : null}
                </span>
                {selected ? <HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2.2} className="shrink-0 text-emerald-500" /> : null}
              </button>
            );
          })}
          {filtered.length === 0 ? <p className="px-3 py-4 text-xs text-muted-foreground">{modelsError ?? "No models returned by this CLI"}</p> : null}
        </div>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-3">
          <span className="text-xs text-muted-foreground">Updated just now</span>
          <button type="button" onClick={onRefresh} disabled={isLoading} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:opacity-50" aria-label="Refresh models">
            <HugeiconsIcon icon={Refresh01Icon} size={14} strokeWidth={2} />
            Refresh
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AttachmentPicker({
  onFiles,
  onUrl,
}: {
  onFiles: (files: FileList | null) => void;
  onUrl: (label?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const pick = (input: HTMLInputElement) => { setOpen(false); input.click(); };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label="Add attachment">
          <HugeiconsIcon icon={Add01Icon} size={18} strokeWidth={1.8} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-56 gap-1 rounded-2xl p-2">
        <button type="button" onClick={() => pick(imageInputRef.current!)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-foreground/[0.07]"><HugeiconsIcon icon={ImageAdd01Icon} size={18} strokeWidth={1.8} /> Add image</button>
        <button type="button" onClick={() => { setOpen(false); onUrl("Add issue or PR"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-foreground/[0.07]"><HugeiconsIcon icon={GithubIcon} size={18} strokeWidth={1.8} /> Add issue or PR</button>
        <button type="button" onClick={() => pick(fileInputRef.current!)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-foreground/[0.07]"><HugeiconsIcon icon={Attachment01Icon} size={18} strokeWidth={1.8} /> Upload file</button>
        <button type="button" onClick={() => { setOpen(false); onUrl("Attach URL"); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-foreground/[0.07]"><HugeiconsIcon icon={Attachment01Icon} size={18} strokeWidth={1.8} /> Attach URL</button>
      </PopoverContent>
      <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { onFiles(event.target.files); event.currentTarget.value = ""; }} />
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { onFiles(event.target.files); event.currentTarget.value = ""; }} />
    </Popover>
  );
}

function SlashOptionPicker({
  options,
  selected,
  onSelect,
  onOpen,
  emptyLabel,
  loading,
  ariaLabel,
  icon,
}: {
  options: AgentChatModelOption[];
  selected: string;
  onSelect: (value: string) => void;
  onOpen: () => void;
  emptyLabel: string;
  loading: boolean;
  ariaLabel: string;
  icon?: typeof Brain02Icon;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((option) => option.id === selected)
    ?? (selected ? { id: selected, label: selected } : undefined)
    ?? options[0]
    ?? { id: "", label: loading ? "Loading…" : emptyLabel };
  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (nextOpen) onOpen(); }}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground" aria-label={ariaLabel}>
          {icon ? <HugeiconsIcon icon={icon} size={17} strokeWidth={1.8} /> : null}
          <span className="font-medium">{current.label}</span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={13} strokeWidth={1.8} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 gap-0 rounded-2xl p-1">
        {options.length === 0 ? <div className="px-3 py-2.5 text-xs text-muted-foreground">{loading ? "Loading options…" : "No options returned by this CLI"}</div> : options.map((option) => (
          <button key={option.id} type="button" onClick={() => { onSelect(option.id); setOpen(false); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-foreground hover:bg-foreground/[0.07]">
            <span className="truncate">{option.label}</span>
            {option.id === current.id ? <HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2} /> : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function ChatOutlineRail({
  prompts,
  activeIndex,
  onJump,
}: {
  prompts: Array<{ id: string; text: string }>;
  activeIndex: number | null;
  onJump: (id: string) => void;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  if (prompts.length < 2) return null;
  const attentionIndex = hoveredIndex;
  const slotHeight = Math.min(8, 640 / prompts.length);
  return (
    <div className="pointer-events-none absolute inset-0 z-10 block" aria-label="Chat outline">
      <div className="pointer-events-auto absolute left-2 top-1/2 flex max-h-[80%] w-9 -translate-y-1/2 flex-col items-start justify-center pl-1">
        {prompts.map((prompt, index) => {
          const distance = attentionIndex === null ? 99 : Math.abs(index - attentionIndex);
          const magnification = distance >= 3 ? 0 : (1 + Math.cos((Math.PI * distance) / 3)) / 2;
          const active = index === activeIndex;
          const width = 10 + magnification * 16;
          const height = 2 + magnification * 2;
          const attention = index === attentionIndex;
          return (
            <div key={prompt.id} className="relative flex w-9 shrink-0 items-center justify-start" style={{ height: slotHeight }} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
              <button type="button" onClick={() => onJump(prompt.id)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)} aria-label={`${index + 1} of ${prompts.length}: ${prompt.text}`} aria-current={active ? "true" : undefined} className="flex h-full w-full items-center justify-start rounded-sm pl-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                <span className={`block rounded-full transition-[width,height,background-color] duration-150 ease-out ${attention ? "bg-foreground" : active ? "bg-foreground/60" : "bg-border/70"}`} style={{ width, height }} />
              </button>
              {attention ? <span className="pointer-events-none absolute left-10 top-1/2 flex h-12 w-[260px] -translate-y-1/2 items-center rounded-lg border border-border bg-card px-3 text-xs text-foreground shadow-lg" aria-hidden="true">{prompt.text}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Props = {
  workspaceId: string;
  chatId: string;
  active: boolean;
  provider: CliAgent;
  cwd: string;
  nativeSessionId: string | null;
  onNativeSessionId: (nativeSessionId: string) => void;
  apiKeys: ProviderKeys;
  initialDraft?: string;
  initialHistoryAttachments?: AgentChatHistoryAttachment[];
  onForkResponse: (destination: "tab" | "workspace", attachment: AgentChatHistoryAttachment) => void;
};

export function AgentChatWorkspace({
  workspaceId,
  chatId,
  active,
  provider,
  cwd,
  nativeSessionId,
  onNativeSessionId,
  apiKeys,
  initialDraft = "",
  initialHistoryAttachments = [],
  onForkResponse,
}: Props) {
  const [draft, setDraft] = useState(initialDraft);
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<AgentChatModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [effortOptions, setEffortOptions] = useState<AgentChatModelOption[]>([]);
  const [modeOptions, setModeOptions] = useState<AgentChatModelOption[]>([]);
  const [planOptions, setPlanOptions] = useState<AgentChatModelOption[]>([]);
  const [selectedEffort, setSelectedEffort] = useState("");
  const [selectedMode, setSelectedMode] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [fastMode, setFastMode] = useState(false);
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [historyAttachments, setHistoryAttachments] = useState(initialHistoryAttachments);
  const attachmentsRef = useRef<AgentAttachment[]>([]);
  attachmentsRef.current = attachments;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState<number | null>(null);
  const modelsRequestedRef = useRef(false);
  const controlsRequestRef = useRef<Promise<[AgentChatModelOption[], AgentChatModelOption[], AgentChatModelOption[]]> | null>(null);
  const [controlsLoading, setControlsLoading] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [agentUsage, setAgentUsage] = useState<AgentUsageStatus | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const speechToTextModelId = usePreferencesStore((state) => state.speechToTextModelId);
  const terminalFontFamily = usePreferencesStore((state) => state.terminalFontFamily);
  const terminalFontSize = usePreferencesStore((state) => state.terminalFontSize);
  const terminalLetterSpacing = usePreferencesStore((state) => state.terminalLetterSpacing);
  const chatTextStyle = useMemo(() => ({
    fontFamily: terminalFontFamily || undefined,
    fontSize: `${terminalFontSize}px`,
    letterSpacing: `${terminalLetterSpacing}px`,
  }), [terminalFontFamily, terminalFontSize, terminalLetterSpacing]);
  const { timeline, submit, cancel, steer, rewriteFromPrompt, hydrated } = useAgentChatSession({
    provider,
    chatId,
    active,
    workspaceId,
    cwd,
    initialRuntimeSessionId: null,
    initialNativeSessionId: nativeSessionId,
    onNativeSessionId,
  });
  const responseOutlineItems = useMemo(
    () => buildAgentChatOutlineItems(timeline.items),
    [timeline.items],
  );
  const outlineWindow = useMemo(() => {
    const total = responseOutlineItems.length;
    if (total <= MAX_OUTLINE_LINES) return { items: responseOutlineItems, start: 0 };
    const active = activeHistoryIndex ?? total - 1;
    const start = Math.min(
      Math.max(0, active - Math.floor(MAX_OUTLINE_LINES / 2)),
      total - MAX_OUTLINE_LINES,
    );
    return {
      items: responseOutlineItems.slice(start, start + MAX_OUTLINE_LINES),
      start,
    };
  }, [activeHistoryIndex, responseOutlineItems]);
  const agent = CLI_AGENT_BY_ID[provider];
  const supportsContextUsage = provider === "codex" || provider === "claude";
  const voiceRecorder = useWhisperRecording({
    onResult: (transcript) => {
      setDraft((current) => current.trimEnd()
        ? `${current.trimEnd()} ${transcript}`
        : transcript);
    },
    onError: setVoiceError,
    speechToTextModelId,
    apiKeys,
  });
  const planOption = planOptions.find((option) => /plan/i.test(`${option.id} ${option.label}`));
  const refreshModels = () => {
    let cancelled = false;
    setAvailableModels([]);
    setModelsError(null);
    setModelsLoading(true);
    void listAgentChatModels(provider, cwd)
      .then((models) => {
        if (cancelled || models.length === 0) return;
        const normalized = models.map((model) => ({
          id: model.id,
          label: model.label || model.id,
          description: model.description,
        }));
        setAvailableModels(normalized);
        setSelectedModel((current) => current || normalized[0]?.id || "");
        void saveAgentModelCache({
          provider,
          models: normalized,
          updatedAt: Date.now(),
        });
      })
      .catch((error) => {
        if (!cancelled) setModelsError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => { cancelled = true; };
  };

  const loadModelsOnDemand = () => {
    if (modelsRequestedRef.current || modelsLoading) return;
    modelsRequestedRef.current = true;
    void refreshModels();
  };

  useEffect(() => {
    if (!active || modelsRequestedRef.current || modelsLoading) return;
    modelsRequestedRef.current = true;
    void refreshModels();
  }, [active, cwd, provider]);

  useEffect(() => {
    if (!active || !supportsContextUsage || !timeline.nativeSessionId) {
      setAgentUsage(null);
      return;
    }
    let disposed = false;
    const refreshUsage = async () => {
      try {
        const statuses = await getAgentUsageStatuses(cwd, provider, timeline.nativeSessionId);
        if (!disposed) setAgentUsage(statuses.find((status) => status.provider === provider) ?? null);
      } catch {
        if (!disposed) setAgentUsage(null);
      }
    };
    void refreshUsage();
    const interval = window.setInterval(refreshUsage, 15_000);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [active, cwd, provider, supportsContextUsage, timeline.nativeSessionId, timeline.status]);

  useEffect(() => {
    let cancelled = false;
    void loadAgentModelCache(provider)
      .then((cache) => {
        if (cancelled || !cache || cache.models.length === 0) return;
        setAvailableModels(cache.models);
        setSelectedModel((current) => current || cache.models[0]?.id || "");
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [provider]);

  const loadControls = () => {
    if (!controlsRequestRef.current) {
      setControlsLoading(true);
      controlsRequestRef.current = Promise.all([
        listAgentChatSlashOptions(provider, cwd, "/effort"),
        listAgentChatSlashOptions(provider, cwd, provider === "codex" ? "/permissions" : "/mode"),
        listAgentChatSlashOptions(provider, cwd, "/plan"),
      ]).finally(() => setControlsLoading(false));
    }
    return controlsRequestRef.current;
  };

  const applyControlOptions = (
    [efforts, modes, plans]: [AgentChatModelOption[], AgentChatModelOption[], AgentChatModelOption[]],
    defaults: { effort?: string | null; permissionMode?: string | null; planMode?: boolean },
  ) => {
    setEffortOptions(efforts);
    setModeOptions(modes);
    setPlanOptions(plans);
    setSelectedEffort(defaults.effort ?? efforts[0]?.id ?? "");
    setSelectedMode(defaults.permissionMode ?? modes[0]?.id ?? "");
    setSelectedPlan(defaults.planMode ? (plans[0]?.id ?? "plan") : "");
  };

  const loadControlsOnDemand = () => {
    void loadControls().then((options) => {
      applyControlOptions(options, {
        effort: selectedEffort || null,
        permissionMode: selectedMode || null,
        planMode: Boolean(selectedPlan),
      });
    }).catch(() => {
      setEffortOptions([]);
      setModeOptions([]);
      setPlanOptions([]);
    });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const config = await loadAgentChatConfig(chatId).catch(() => null);
      if (cancelled) return;
      if (config) {
        setSelectedModel(config.model ?? "");
        setSelectedEffort(config.effort ?? "");
        setSelectedMode(config.permissionMode ?? "");
        setFastMode(config.fastMode);
        setSelectedPlan(config.planMode ? "plan" : "");
      }

      const needsCliDefaults = !config?.effort || !config?.permissionMode;
      if (!needsCliDefaults) {
        setConfigLoaded(true);
        return;
      }
      if (!active) return;

      try {
        const options = await loadControls();
        if (!cancelled) {
          applyControlOptions(options, config ?? {});
        }
      } catch {
        if (!cancelled) {
          setEffortOptions([]);
          setModeOptions([]);
          setPlanOptions([]);
        }
      }
      if (!cancelled) setConfigLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [active, chatId]);

  useEffect(() => {
    if (!configLoaded) return;
    const timer = window.setTimeout(() => {
      void saveAgentChatConfig({
        chatId,
        provider,
        model: selectedModel || null,
        effort: selectedEffort || null,
        permissionMode: selectedMode || null,
        fastMode,
        planMode: Boolean(selectedPlan),
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [chatId, configLoaded, fastMode, provider, selectedEffort, selectedMode, selectedModel, selectedPlan]);

  const send = async () => {
    const prompt = draft.trim();
    if (!prompt && attachments.length === 0 && historyAttachments.length === 0) return;
    const attachmentContext = attachments.length > 0
      ? `\n\nAttached context:\n${attachments.map((item) => `--- ${item.label} ---\n${item.context}`).join("\n")}`
      : "";
    const historyContext = historyAttachments.length > 0
      ? `\n\nChat history attachment:\n${historyAttachments.map((attachment) => attachment.context).join("\n\n")}`
      : "";
    const displayPrompt = prompt || (attachments.length > 0 ? "Please inspect the attached context." : "Continue from the attached conversation.");
    const composedPrompt = `${displayPrompt}${attachmentContext}${historyContext}`;
    const dispatch = timeline.status === "running" ? steer : submit;
    if (await dispatch(composedPrompt, selectedModel, displayPrompt, historyAttachments)) {
      setDraft("");
      revokeAttachmentPreviews(attachments);
      setAttachments([]);
      setHistoryAttachments([]);
    }
  };

  const startVoiceToText = async () => {
    if (voiceRecorder.transcribing || !voiceRecorder.supported) return;
    setVoiceError(null);
    await voiceRecorder.start();
  };

  useEffect(() => () => revokeAttachmentPreviews(attachmentsRef.current), []);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const next = await Promise.all(Array.from(files).slice(0, 8).map(async (file): Promise<AgentAttachment> => {
      const localPath = (file as File & { path?: string }).path;
      if (file.type.startsWith("image/")) {
        return {
          label: file.name,
          kind: "image",
          previewUrl: URL.createObjectURL(file),
          context: localPath ? `Image file available at: ${localPath}` : `Image attachment selected: ${file.name}`,
        };
      }
      return { label: file.name, kind: "file", context: (await file.text()).slice(0, 50_000) };
    }));
    setAttachments((current) => [...current, ...next]);
  };

  const handleUrl = (label = "Attach URL") => {
    const url = window.prompt(label);
    if (!url?.trim()) return;
    setAttachments((current) => [...current, { label: url.trim(), kind: "url", context: `URL reference: ${url.trim()}` }]);
  };

  const scrollToLatest = () => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  };

  useEffect(() => {
    if (nearBottom) scrollToLatest();
  }, [nearBottom, timeline.items]);

  useEffect(() => {
    if (timeline.status !== "running") return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void cancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [cancel, timeline.status]);

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex h-10 shrink-0 items-center border-b border-border/60 px-5 py-0">
        <div className="flex min-w-0 items-center gap-2">
          <HugeiconsIcon icon={AiChat01Icon} size={18} strokeWidth={1.8} />
          <h2 className="truncate font-mono text-xs font-medium text-foreground" title={timeline.nativeSessionId ?? "Session ID pending"}>
            {timeline.nativeSessionId ?? "Session ID pending"}
          </h2>
          {timeline.status === "running" ? <AgentStateDot state="working" /> : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 flex-1">
          <ChatOutlineRail
            prompts={outlineWindow.items}
            activeIndex={activeHistoryIndex === null ? null : activeHistoryIndex - outlineWindow.start}
            onJump={(id) => document.getElementById(`agent-chat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
          />
          <div
          ref={scrollRef}
          onScroll={(event) => {
            const viewport = event.currentTarget;
            setNearBottom(
              viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 72,
            );
            const anchor = viewport.getBoundingClientRect().top + 120;
            let nextIndex: number | null = null;
            responseOutlineItems.forEach((item, index) => {
              const node = document.getElementById(`agent-chat-${item.id}`);
              if (node && node.getBoundingClientRect().top <= anchor) nextIndex = index;
            });
            setActiveHistoryIndex(nextIndex);
          }}
          className="h-full min-h-0 overflow-y-auto px-5 py-9 pl-14 sm:px-10 sm:pl-16"
        >
        <div className="mx-auto w-full max-w-3xl space-y-7">
          {timeline.items.length === 0 ? (
            <div className="py-14 text-center">
              <AgentCliIcon agent={provider} size="md" />
              <h3 className="mt-4 text-sm font-medium text-foreground">Start a {agent.name} session</h3>
              <p className="mt-1 text-sm text-muted-foreground">Messages and tool activity will appear here.</p>
            </div>
          ) : (
            timeline.items.map((item) => {
              if (item.kind === "user") {
                return <div key={item.id} id={`agent-chat-${item.id}`} style={chatTextStyle}><UserPrompt item={item} canEdit onEdit={(text) => rewriteFromPrompt(item.id, text, selectedModel)} /></div>;
              }
              if (item.kind === "assistant") {
                const history = buildAgentChatForkHistory(timeline.items, item.id);
                return <div key={item.id} className="max-w-2xl"><div style={chatTextStyle}><Streamdown className="select-text leading-7 text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" components={markdownComponents}>{item.text}</Streamdown></div><AssistantResponseActions text={item.text} workedMs={item.workedMs} onFork={(destination) => onForkResponse(destination, history)} /></div>;
              }
              if (item.kind === "reasoning") {
                return <details key={item.id} className="group text-sm text-muted-foreground"><summary className="cursor-pointer select-none text-xs font-medium">Reasoning</summary><p className="mt-2 whitespace-pre-wrap border-l border-border pl-3 leading-6">{item.text}</p></details>;
              }
              return <div key={item.id} className="rounded-lg border border-border/60 bg-card/35 px-3 py-2 text-xs"><div className="flex items-center justify-between gap-3"><span className="truncate font-medium text-foreground">{item.name}</span><span className="text-muted-foreground">{item.status}</span></div>{item.detail ? <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5 text-muted-foreground">{item.detail}</pre> : null}</div>;
            })
          )}
          {timeline.status === "running" ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-label="Agent is responding">
              <AgentStateDot state="working" />
              <span>Agent is responding</span>
            </div>
          ) : null}
          {timeline.error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{timeline.error}</p> : null}
          {timeline.usage ? (
            <p className="text-[11px] tabular-nums text-muted-foreground">
              {timeline.usage.inputTokens.toLocaleString()} input · {timeline.usage.outputTokens.toLocaleString()} output tokens
            </p>
          ) : null}
        </div>
          </div>
          {!nearBottom ? (
            <button type="button" onClick={scrollToLatest} aria-label="Scroll to latest message" className="absolute bottom-4 left-1/2 z-20 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md hover:text-foreground"><HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={2} /></button>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 px-5 pb-5 pt-3 sm:px-10">
        <div className="mx-auto w-full max-w-3xl rounded-[22px] border border-border/80 bg-card/60 p-3 shadow-sm transition-colors focus-within:border-border focus-within:bg-card/80">
           <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} placeholder="Message the agent, tag @files, or use /commands and /skills" aria-label="Message the agent" style={chatTextStyle} className="w-full resize-none bg-transparent px-1 leading-6 text-foreground outline-none placeholder:text-muted-foreground" />
          {attachments.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {attachments.map((attachment, index) => (
                <button
                  key={`${attachment.label}-${index}`}
                  type="button"
                  onClick={() => setAttachments((current) => { const removed = current[index]; if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl); return current.filter((_, itemIndex) => itemIndex !== index); })}
                  className="max-w-56 truncate rounded-full border border-border/70 bg-background/50 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                  title="Remove attachment"
                >
                  {attachment.previewUrl ? <img src={attachment.previewUrl} alt="" className="mr-1.5 size-5 rounded object-cover" /> : null}
                  {attachment.label} ×
                </button>
              ))}
            </div>
          ) : null}
          {historyAttachments.length > 0 ? <div className="mb-2 flex flex-wrap gap-1.5">{historyAttachments.map((attachment, index) => <button key={`${attachment.kind}-${index}`} type="button" onClick={() => setHistoryAttachments((current) => current.filter((_, attachmentIndex) => attachmentIndex !== index))} title="Remove chat history" className="rounded-lg"><ChatHistoryCard attachment={attachment} /></button>)}</div> : null}
          <div className="mt-2 flex items-center justify-between gap-2 text-muted-foreground">
            <div className="flex min-w-0 items-center gap-0.5">
              <AttachmentPicker onFiles={handleFiles} onUrl={handleUrl} />
              <ModelPicker agent={provider} selectedModel={selectedModel} models={availableModels} isLoading={modelsLoading} modelsError={modelsError} onOpen={loadModelsOnDemand} onRefresh={refreshModels} onSelect={setSelectedModel} />
              <SlashOptionPicker options={effortOptions} selected={selectedEffort} onSelect={setSelectedEffort} onOpen={loadControlsOnDemand} emptyLabel="Effort" loading={controlsLoading} ariaLabel="Select reasoning effort" icon={Brain02Icon} />
              <SlashOptionPicker options={modeOptions} selected={selectedMode} onSelect={setSelectedMode} onOpen={loadControlsOnDemand} emptyLabel="Access mode" loading={controlsLoading} ariaLabel="Select agent mode" icon={ShieldBanIcon} />
              <button type="button" onClick={() => setFastMode((current) => !current)} aria-pressed={fastMode} aria-label="Toggle fast mode" className={`hidden size-8 items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.07] md:inline-flex ${fastMode ? "bg-foreground/10 text-foreground" : "text-muted-foreground"}`}><HugeiconsIcon icon={FlashIcon} size={15} strokeWidth={1.9} /></button>
              {planOption ? <button type="button" onClick={() => setSelectedPlan((current) => current === planOption.id ? "" : planOption.id)} aria-pressed={selectedPlan === planOption.id} aria-label={`Toggle ${planOption.label}`} className={`hidden size-8 items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.07] md:inline-flex ${selectedPlan === planOption.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground"}`}><HugeiconsIcon icon={CheckListIcon} size={17} strokeWidth={1.8} /></button> : null}
            </div>
            {voiceRecorder.recording || voiceRecorder.transcribing ? (
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={voiceRecorder.cancel} disabled={voiceRecorder.transcribing} aria-label="Cancel voice transcript" className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground disabled:opacity-40"><HugeiconsIcon icon={Cancel01Icon} size={16} strokeWidth={2} /></button>
                <VoiceLevelMeter audioLevel={voiceRecorder.audioLevel} active={voiceRecorder.recording} />
                <span className="min-w-10 font-mono text-xs tabular-nums text-muted-foreground">{voiceRecorder.transcribing ? "…" : formatDuration(voiceRecorder.duration)}</span>
                <button type="button" onClick={voiceRecorder.confirm} disabled={voiceRecorder.transcribing} aria-label="Confirm voice transcript" className="flex size-8 items-center justify-center rounded-full bg-foreground text-background transition-colors hover:opacity-85 disabled:opacity-40"><HugeiconsIcon icon={Tick02Icon} size={16} strokeWidth={2.2} /></button>
              </div>
            ) : (
              <div className="flex shrink-0 items-center gap-0.5">
                <ContextWindowMeter usage={agentUsage} />
                <button type="button" onClick={() => void startVoiceToText()} disabled={!active} aria-label="Voice to text" title={voiceError ?? "Voice to text"} className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.07] hover:text-foreground disabled:opacity-40"><HugeiconsIcon icon={Mic01Icon} size={18} strokeWidth={1.8} /></button>
                {timeline.status === "running" && (draft.trim() || attachments.length > 0 || historyAttachments.length > 0) ? (
                  <button type="button" onClick={() => void send()} aria-label="Steer agent with this prompt" className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-2.5 text-xs font-medium text-background"><HugeiconsIcon icon={ArrowUp01Icon} size={15} strokeWidth={2} /><span>Steer</span></button>
                ) : timeline.status === "running" ? (
                  <button type="button" onClick={() => void cancel()} aria-label="Cancel agent turn" className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background"><HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={2} /></button>
                ) : (
                  <button type="button" onClick={() => void send()} disabled={!hydrated || (!draft.trim() && attachments.length === 0)} aria-label="Send message" className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background disabled:opacity-35"><HugeiconsIcon icon={ArrowUp01Icon} size={16} strokeWidth={2} /></button>
                )}
              </div>
            )}
          </div>
          {voiceError ? <p role="alert" className="mt-2 px-1 text-xs text-destructive">{voiceError}</p> : null}
        </div>
      </div>
    </section>
  );
}

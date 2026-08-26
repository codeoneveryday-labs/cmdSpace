import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import { AgentStateDot } from "@/modules/terminal/AgentStateDot";
import { CLI_AGENT_BY_ID, type CliAgent } from "@/modules/terminal/lib/cliAgents";
import { useAgentChatSession } from "@/modules/ai/hooks/useAgentChatSession";
import { listAgentChatModels, listAgentChatSlashOptions, type AgentChatModelOption } from "@/modules/ai/lib/agentChatRuntime";
import { buildAgentChatOutlineItems } from "@/modules/ai/lib/agentChatTimeline";
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
  Settings02Icon,
  ShieldBanIcon,
  Tick02Icon,
  Refresh01Icon,
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

const markdownComponents = { code: MarkdownCode };
const MAX_OUTLINE_LINES = 80;

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
  onSelect,
}: {
  agent: CliAgent;
  selectedModel: string;
  models: AgentChatModelOption[];
  isLoading: boolean;
  modelsError?: string | null;
  onRefresh: () => void;
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
  const label = selected?.label || selectedModel || (isLoading ? "Loading models…" : "No model available");

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
  ariaLabel,
  icon,
}: {
  options: AgentChatModelOption[];
  selected: string;
  onSelect: (value: string) => void;
  ariaLabel: string;
  icon?: typeof Brain02Icon;
}) {
  const [open, setOpen] = useState(false);
  if (options.length === 0) return null;
  const current = options.find((option) => option.id === selected) ?? options[0];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-foreground/[0.07] hover:text-foreground" aria-label={ariaLabel}>
          {icon ? <HugeiconsIcon icon={icon} size={17} strokeWidth={1.8} /> : null}
          <span className="font-medium">{current.label}</span>
          <HugeiconsIcon icon={ArrowDown01Icon} size={13} strokeWidth={1.8} />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-56 gap-0 rounded-2xl p-1">
        {options.map((option) => (
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
  workspaceName: string;
  workspaceId: string;
  provider: CliAgent;
  cwd: string;
  nativeSessionId: string | null;
  onNativeSessionId: (nativeSessionId: string) => void;
};

export function AgentChatWorkspace({
  workspaceName,
  workspaceId,
  provider,
  cwd,
  nativeSessionId,
  onNativeSessionId,
}: Props) {
  const [draft, setDraft] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [availableModels, setAvailableModels] = useState<AgentChatModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [effortOptions, setEffortOptions] = useState<AgentChatModelOption[]>([]);
  const [modeOptions, setModeOptions] = useState<AgentChatModelOption[]>([]);
  const [planOptions, setPlanOptions] = useState<AgentChatModelOption[]>([]);
  const [selectedEffort, setSelectedEffort] = useState("");
  const [selectedMode, setSelectedMode] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("");
  const [fastMode, setFastMode] = useState(false);
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const attachmentsRef = useRef<AgentAttachment[]>([]);
  attachmentsRef.current = attachments;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState<number | null>(null);
  const { timeline, submit, cancel, hydrated } = useAgentChatSession({
    provider,
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
  const planOption = planOptions.find((option) => /plan/i.test(`${option.id} ${option.label}`));
  const refreshModels = () => {
    let cancelled = false;
    setAvailableModels([]);
    setModelsError(null);
    setModelsLoading(true);
    setSelectedModel("");
    void listAgentChatModels(provider, cwd)
      .then((models) => {
        if (cancelled || models.length === 0) return;
        const normalized = models.map((model) => ({
          id: model.id,
          label: model.label || model.id,
          description: model.description,
        }));
        setAvailableModels(normalized);
        setSelectedModel(normalized[0]?.id ?? "");
      })
      .catch((error) => {
        if (!cancelled) setModelsError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => { cancelled = true; };
  };

  useEffect(() => refreshModels(), [cwd, provider]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listAgentChatSlashOptions(provider, cwd, "/effort"),
      listAgentChatSlashOptions(provider, cwd, provider === "codex" ? "/permissions" : "/mode"),
      listAgentChatSlashOptions(provider, cwd, "/mode"),
    ]).then(([efforts, modes, plans]) => {
      if (cancelled) return;
      setEffortOptions(efforts);
      setModeOptions(modes);
      setPlanOptions(plans);
      setSelectedEffort(efforts[0]?.id ?? "");
      setSelectedMode(modes[0]?.id ?? "");
      setSelectedPlan(plans[0]?.id ?? "");
    }).catch(() => {
      if (!cancelled) { setEffortOptions([]); setModeOptions([]); setPlanOptions([]); }
    });
    return () => { cancelled = true; };
  }, [cwd, provider]);

  const send = async () => {
    const prompt = draft.trim();
    if (!selectedModel || (!prompt && attachments.length === 0)) return;
    const attachmentContext = attachments.length > 0
      ? `\n\nAttached context:\n${attachments.map((item) => `--- ${item.label} ---\n${item.context}`).join("\n")}`
      : "";
    const composedPrompt = `${prompt || "Please inspect the attached context."}${attachmentContext}`;
    if (await submit(composedPrompt, selectedModel)) {
      setDraft("");
      revokeAttachmentPreviews(attachments);
      setAttachments([]);
    }
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
      <header className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <HugeiconsIcon icon={AiChat01Icon} size={18} strokeWidth={1.8} />
          <h2 className="truncate text-sm font-medium text-foreground">{workspaceName}</h2>
          <span className="text-xs text-muted-foreground">{agent.name}</span>
          {timeline.status === "running" ? <AgentStateDot state="working" /> : null}
        </div>
        <button type="button" className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground" aria-label="Chat settings">
          <HugeiconsIcon icon={Settings02Icon} size={16} strokeWidth={1.8} />
        </button>
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
              <HugeiconsIcon icon={AiChat01Icon} size={28} strokeWidth={1.8} />
              <h3 className="mt-4 text-sm font-medium text-foreground">Start a {agent.name} session</h3>
              <p className="mt-1 text-sm text-muted-foreground">Messages and tool activity will appear here.</p>
            </div>
          ) : (
            timeline.items.map((item) => {
              if (item.kind === "user") {
                return <div key={item.id} id={`agent-chat-${item.id}`} className="flex justify-end"><p className="max-w-[85%] rounded-2xl rounded-br-md bg-foreground px-3.5 py-2.5 text-sm leading-6 text-background">{item.text}</p></div>;
              }
              if (item.kind === "assistant") {
                return <Streamdown key={item.id} className="max-w-2xl select-text text-[15px] leading-7 text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0" components={markdownComponents}>{item.text}</Streamdown>;
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
        {!nearBottom ? (
          <button type="button" onClick={scrollToLatest} aria-label="Scroll to latest message" className="sticky bottom-2 left-1/2 mt-4 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md hover:text-foreground"><HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={2} /></button>
        ) : null}
          </div>
        </div>
      </div>

      <div className="shrink-0 px-5 pb-5 pt-3 sm:px-10">
        <div className="mx-auto w-full max-w-3xl rounded-[22px] border border-border/80 bg-card/60 p-3 shadow-sm transition-colors focus-within:border-border focus-within:bg-card/80">
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={2} placeholder="Message the agent, tag @files, or use /commands and /skills" aria-label="Message the agent" className="w-full resize-none bg-transparent px-1 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground" />
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
          <div className="mt-2 flex items-center justify-between gap-2 text-muted-foreground">
            <div className="flex min-w-0 items-center gap-0.5">
              <AttachmentPicker onFiles={handleFiles} onUrl={handleUrl} />
              <ModelPicker agent={provider} selectedModel={selectedModel} models={availableModels} isLoading={modelsLoading} modelsError={modelsError} onRefresh={refreshModels} onSelect={setSelectedModel} />
              <SlashOptionPicker options={effortOptions} selected={selectedEffort} onSelect={setSelectedEffort} ariaLabel="Select reasoning effort" icon={Brain02Icon} />
              <SlashOptionPicker options={modeOptions} selected={selectedMode} onSelect={setSelectedMode} ariaLabel="Select agent mode" icon={ShieldBanIcon} />
              <button type="button" onClick={() => setFastMode((current) => !current)} aria-pressed={fastMode} aria-label="Toggle fast mode" className={`hidden size-8 items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.07] md:inline-flex ${fastMode ? "bg-foreground/10 text-foreground" : "text-muted-foreground"}`}><HugeiconsIcon icon={FlashIcon} size={15} strokeWidth={1.9} /></button>
              {planOption ? <button type="button" onClick={() => setSelectedPlan((current) => current === planOption.id ? "" : planOption.id)} aria-pressed={selectedPlan === planOption.id} aria-label={`Toggle ${planOption.label}`} className={`hidden size-8 items-center justify-center rounded-full transition-colors hover:bg-foreground/[0.07] md:inline-flex ${selectedPlan === planOption.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground"}`}><HugeiconsIcon icon={CheckListIcon} size={17} strokeWidth={1.8} /></button> : null}
            </div>
            {timeline.status === "running" ? (
              <button type="button" onClick={() => void cancel()} aria-label="Cancel agent turn" className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background"><HugeiconsIcon icon={Cancel01Icon} size={15} strokeWidth={2} /></button>
            ) : (
              <button type="button" onClick={() => void send()} disabled={!hydrated || !selectedModel || (!draft.trim() && attachments.length === 0)} aria-label="Send message" className="flex size-8 items-center justify-center rounded-lg bg-foreground text-background disabled:opacity-35"><HugeiconsIcon icon={ArrowUp01Icon} size={16} strokeWidth={2} /></button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

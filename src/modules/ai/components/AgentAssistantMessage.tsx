import { Streamdown } from "streamdown";
import { MarkdownCode } from "@/components/ai-elements/markdown-code";
import {
  Copy01Icon,
  GitForkIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AgentChatTimelineItem } from "@/modules/ai/lib/agentChatTimeline";

const markdownComponents = { code: MarkdownCode };

function formatWorkedDuration(milliseconds: number | undefined): string {
  const seconds = Math.max(1, Math.round((milliseconds ?? 0) / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

function AssistantResponseActions({
  text,
  workedMs,
  onFork,
}: {
  text: string;
  workedMs?: number;
  onFork: (destination: "tab" | "workspace") => void;
}) {
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
  return (
    <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 text-[11px] text-muted-foreground sm:text-xs">
      <button
        type="button"
        onClick={() => void copy()}
        aria-label="Copy response"
        className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
      >
        <HugeiconsIcon icon={Copy01Icon} size={15} strokeWidth={1.8} />
        <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Fork response"
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-1.5 transition-colors hover:bg-foreground/[0.07] hover:text-foreground"
          >
            <HugeiconsIcon icon={GitForkIcon} size={15} strokeWidth={1.8} />
            <span className="hidden sm:inline">Fork</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="bottom" className="min-w-56">
          <DropdownMenuItem onSelect={() => onFork("tab")}>
            <HugeiconsIcon icon={GitForkIcon} size={16} strokeWidth={1.8} />
            Fork in a new tab
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onFork("workspace")}>
            <HugeiconsIcon icon={GitForkIcon} size={16} strokeWidth={1.8} />
            Fork in a new workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className="hidden min-[380px]:inline text-muted-foreground/80">
        Worked for {formatWorkedDuration(workedMs)}
      </span>
    </div>
  );
}

export function AgentAssistantMessage({
  item,
  style,
  onFork,
}: {
  item: Extract<AgentChatTimelineItem, { kind: "assistant" }>;
  style: React.CSSProperties;
  onFork: (destination: "tab" | "workspace") => void;
}) {
  return (
    <div className="max-w-2xl">
      <div style={style}>
        <Streamdown
          className="select-text leading-7 text-foreground [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
          components={markdownComponents}
        >
          {item.text}
        </Streamdown>
      </div>
      <AssistantResponseActions
        text={item.text}
        workedMs={item.workedMs}
        onFork={onFork}
      />
    </div>
  );
}

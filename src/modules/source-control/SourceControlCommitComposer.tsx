import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { IS_MAC } from "@/lib/platform";
import { useEffect, useState, type KeyboardEvent } from "react";

const TOOLTIP_CLASS = "border border-border/70 bg-zinc-950 text-zinc-100 shadow-lg shadow-black/30 dark:border-border/60 dark:bg-zinc-950 dark:text-zinc-100";

function CommitFeedback({ feedback }: { feedback: { tone: "error" | "success"; message: string } | null }) {
  const [visibleFeedback, setVisibleFeedback] = useState(feedback);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    if (!feedback) { setIsVisible(false); return; }
    setVisibleFeedback(feedback);
    setIsVisible(true);
    const hideTimer = window.setTimeout(() => setIsVisible(false), 3600);
    const clearTimer = window.setTimeout(() => setVisibleFeedback((current) => current?.message === feedback.message && current.tone === feedback.tone ? null : current), 3900);
    return () => { window.clearTimeout(hideTimer); window.clearTimeout(clearTimer); };
  }, [feedback]);
  if (!visibleFeedback) return null;
  const isError = visibleFeedback.tone === "error";
  return <div className={cn("pointer-events-none absolute inset-x-3 top-[calc(100%-0.25rem)] z-20 flex min-w-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug shadow-lg shadow-black/15 backdrop-blur transition-all duration-200", isVisible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0", isError ? "border-destructive/30 bg-card/95 text-destructive" : "border-border/70 bg-card/95 text-muted-foreground")}><span className={cn("size-1.5 shrink-0 rounded-full", isError ? "bg-destructive" : "bg-foreground/70")} /><span className={cn("min-w-0 flex-1 truncate", isError ? "text-destructive" : "text-muted-foreground")}>{visibleFeedback.message}</span></div>;
}

export function SourceControlCommitComposer({
  commitMessage,
  onCommitMessage,
  stagedCount,
  canCommit,
  commitDisabledReason,
  actionBusy,
  canPush,
  pushDisabledReason,
  upstreamLabel,
  feedback,
  onCommit,
  onPush,
}: {
  commitMessage: string;
  onCommitMessage: (message: string) => void;
  stagedCount: number;
  canCommit: boolean;
  commitDisabledReason: string | null;
  actionBusy: string | null;
  canPush: boolean;
  pushDisabledReason: string;
  upstreamLabel: string;
  feedback: { tone: "error" | "success"; message: string } | null;
  onCommit: () => void;
  onPush: () => void;
}) {
  const commitShortcut = IS_MAC ? "⌘↩" : "Ctrl+Enter";
  const commitHint = canCommit ? `Commit with ${commitShortcut}.` : (commitDisabledReason ?? `Commit with ${commitShortcut}.`);
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canCommit) {
      event.preventDefault();
      onCommit();
    }
  };
  return (
    <div className="relative shrink-0 space-y-2 border-b border-border/40 bg-gradient-to-b from-card/65 to-card/30 px-2.5 pb-2.5 pt-2.5">
      <div className={cn("relative rounded-lg border bg-background/95 shadow-sm transition-colors", commitMessage.length > 0 ? "border-border/70" : "border-border/45", "focus-within:border-primary/45 focus-within:shadow-md focus-within:shadow-primary/5")}>
        <Textarea value={commitMessage} onChange={(event) => onCommitMessage(event.target.value)} onKeyDown={handleKeyDown} placeholder="Commit message" rows={3} className="min-h-[72px] resize-none rounded-lg bg-transparent px-3 pb-7 pt-2.5 text-[12.5px] leading-snug shadow-none placeholder:text-muted-foreground/65 focus-visible:ring-0 focus:border-0" />
        <div className="pointer-events-none absolute inset-x-3 bottom-1.5 flex items-center justify-between gap-2 p-1 text-[10px] tabular-nums text-muted-foreground/55">{commitMessage.length > 0 ? <span>Ch: {commitMessage.length}</span> : <span className="flex items-center gap-2">{commitShortcut} <span>to commit</span></span>}</div>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 text-[10.5px] text-muted-foreground"><span className={cn("size-1.5 shrink-0 rounded-full transition-colors", canCommit ? "bg-foreground/80" : stagedCount > 0 ? "bg-muted-foreground/60" : "bg-muted-foreground/30")} /><span className="truncate font-medium text-foreground/85">{stagedCount === 0 ? "Nothing staged" : `${stagedCount} ${stagedCount === 1 ? "file" : "files"} staged`}</span><span className="ml-auto shrink-0 truncate text-muted-foreground/65">{upstreamLabel}</span></div>
      <div className="grid w-full grid-cols-2 gap-1.5">
        <Tooltip><TooltipTrigger asChild><Button size="xs" className="h-7 cursor-pointer text-[11.5px] font-semibold tracking-tight shadow-sm disabled:cursor-not-allowed disabled:shadow-none" disabled={!canCommit} onClick={onCommit}>{actionBusy === "commit" ? "Committing…" : "Commit"}</Button></TooltipTrigger><TooltipContent side="bottom" className={cn(TOOLTIP_CLASS, "text-[10.5px]")}>{commitHint}</TooltipContent></Tooltip>
        <Tooltip><TooltipTrigger asChild><Button size="xs" variant="secondary" className="h-7 cursor-pointer text-[11.5px] font-medium disabled:cursor-not-allowed" disabled={!canPush || !!actionBusy} onClick={onPush}>{actionBusy === "push" ? "Pushing…" : "Push"}</Button></TooltipTrigger><TooltipContent side="bottom" className={cn(TOOLTIP_CLASS, "max-w-64 text-[10.5px]")}>{pushDisabledReason}</TooltipContent></Tooltip>
      </div>
      <CommitFeedback feedback={feedback} />
    </div>
  );
}

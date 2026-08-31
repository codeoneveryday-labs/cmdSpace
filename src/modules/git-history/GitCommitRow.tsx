import { cn } from "@/lib/utils";
import type { GitLogEntry } from "@/modules/ai/lib/native";
import { File02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { memo } from "react";
import { GraphRail } from "./GraphRail";
import type { GraphRow } from "./lib/graph";
import { authorInitials, authorTint, compactDate, highlight } from "./gitHistoryPresentation";

const ROW_HEIGHT = 32;

export const GitCommitRow = memo(function GitCommitRow({
  commit,
  query,
  active,
  graphRow,
  maxLaneCount,
  gridTemplate,
  onClick,
}: {
  commit: GitLogEntry;
  query: string;
  active: boolean;
  graphRow: GraphRow | null;
  maxLaneCount: number;
  gridTemplate: string;
  onClick: (sha: string, event: React.MouseEvent<HTMLElement>) => void;
}) {
  const date = compactDate(commit.timestampSecs);
  const initials = authorInitials(commit.author);
  const totalStat = commit.insertions + commit.deletions;
  return (
    <button type="button" onClick={(event) => onClick(commit.sha, event)} className={cn("group relative grid h-full w-full cursor-pointer items-center gap-3 border-l-2 border-transparent pr-3 text-left transition-colors", active ? "border-l-primary/70 bg-accent/45" : "hover:bg-accent/25")} style={{ gridTemplateColumns: gridTemplate }}>
      <div className="flex items-center justify-start pl-1">
        {graphRow ? <GraphRail row={graphRow} rowHeight={ROW_HEIGHT} maxLaneCount={maxLaneCount} active={active} /> : null}
      </div>
      <span className="pl-px font-mono text-[10.5px] tabular-nums text-muted-foreground/80">{commit.shortSha}</span>
      <span className={cn("min-w-0 truncate text-[12px] leading-tight", active ? "font-semibold text-foreground" : "font-medium text-foreground/95")}>
        {commit.subject ? highlight(commit.subject, query) : <span className="text-muted-foreground">(no subject)</span>}
      </span>
      <span aria-hidden />
      <span className="ml-2 inline-flex h-[18px] max-w-full min-w-0 items-center gap-1.5 justify-self-start self-center overflow-hidden rounded-md bg-foreground/6 pl-1 pr-1.5 text-[10.5px] font-medium text-foreground/85" title={commit.authorEmail || commit.author}>
        <span className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-[3px] font-mono text-[8.5px] font-bold uppercase tabular-nums text-background" style={{ backgroundColor: authorTint(commit.authorEmail || commit.author) }}>{initials}</span>
        <span className="min-w-0 truncate">{commit.author ? highlight(commit.author, query) : "Unknown"}</span>
      </span>
      <span className="text-right font-mono text-[10.5px] tabular-nums text-muted-foreground/75">{date}</span>
      <span className="flex min-w-0 items-center justify-end gap-1.5 font-mono text-[10px] tabular-nums">
        {commit.filesChanged > 0 ? <span className="inline-flex items-center gap-1 text-muted-foreground/75" title={`${commit.filesChanged} ${commit.filesChanged === 1 ? "file" : "files"} changed`}><HugeiconsIcon icon={File02Icon} size={10.5} strokeWidth={1.7} className="opacity-70" /><span className="font-medium">{commit.filesChanged}</span></span> : null}
        {commit.filesChanged > 0 && totalStat > 0 ? <span aria-hidden className="size-[3px] shrink-0 rounded-full bg-muted-foreground/30" /> : null}
        {totalStat > 0 ? <span className="inline-flex items-center gap-1">{commit.insertions > 0 ? <span className="font-semibold text-emerald-600/85 dark:text-emerald-400/85">+{commit.insertions}</span> : null}{commit.deletions > 0 ? <span className="font-semibold text-rose-600/85 dark:text-rose-400/85">−{commit.deletions}</span> : null}</span> : commit.filesChanged === 0 ? <span className="text-muted-foreground/40">—</span> : null}
      </span>
    </button>
  );
});

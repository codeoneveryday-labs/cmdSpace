import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  FolderGitTwoIcon,
  GitBranchIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SourceControlRemoteActions } from "./SourceControlRemoteActions";

export function SourceControlPanelHeader({
  repoLabel,
  ahead,
  behind,
  detached,
  fetchBusy,
  pullBusy,
  isRefreshing,
  canFetch,
  canPull,
  isDiverged,
  hasUpstream,
  refreshAnimating,
  onFetch,
  onPull,
  onRefresh,
  onOpenGitGraph,
}: {
  repoLabel: string;
  ahead: number;
  behind: number;
  detached: boolean;
  fetchBusy: boolean;
  pullBusy: boolean;
  isRefreshing: boolean;
  canFetch: boolean;
  canPull: boolean;
  isDiverged: boolean;
  hasUpstream: boolean;
  refreshAnimating: boolean;
  onFetch: () => void;
  onPull: () => void;
  onRefresh: () => void;
  onOpenGitGraph?: () => void;
}) {
  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border/50 px-3 pb-2.5 pt-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <div className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-foreground/5 px-2 py-1 text-[11.5px] font-medium leading-none text-foreground transition-colors hover:bg-foreground/10">
            <HugeiconsIcon icon={FolderGitTwoIcon} size={12} strokeWidth={1.9} className="shrink-0 text-muted-foreground" />
            <span className="max-w-[140px] truncate">{repoLabel}</span>
          </div>
          {ahead > 0 || behind > 0 ? (
            <div className="flex shrink-0 items-center gap-0.5 text-[10px] font-semibold tabular-nums leading-none text-muted-foreground">
              {ahead > 0 ? <span className="inline-flex items-center gap-0.5 rounded-md border border-border/60 px-1 py-0.5"><HugeiconsIcon icon={ArrowUp01Icon} size={9} strokeWidth={2.2} />{ahead}</span> : null}
              {behind > 0 ? <span className="inline-flex items-center gap-0.5 rounded-md border border-border/60 px-1 py-0.5"><HugeiconsIcon icon={ArrowDown01Icon} size={9} strokeWidth={2.2} />{behind}</span> : null}
            </div>
          ) : null}
          {detached ? <span className="rounded bg-muted/55 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">detached</span> : null}
        </div>
        <SourceControlRemoteActions
          fetchBusy={fetchBusy}
          pullBusy={pullBusy}
          isRefreshing={isRefreshing}
          canFetch={canFetch}
          canPull={canPull}
          isDiverged={isDiverged}
          hasUpstream={hasUpstream}
          behind={behind}
          refreshAnimating={refreshAnimating}
          onFetch={onFetch}
          onPull={onPull}
          onRefresh={onRefresh}
        />
      </header>
      {onOpenGitGraph ? (
        <button type="button" onClick={onOpenGitGraph} className="group flex shrink-0 cursor-pointer items-center gap-2 border-b border-border/40 px-3 py-2 text-left text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground">
          <HugeiconsIcon icon={GitBranchIcon} size={13} strokeWidth={1.85} className="shrink-0" />
          <span className="flex-1 text-[12px] font-medium">Commit Graph</span>
          <HugeiconsIcon icon={ArrowRight01Icon} size={12} strokeWidth={2} className="shrink-0 opacity-50 transition-transform group-hover:translate-x-0.5" />
        </button>
      ) : null}
    </>
  );
}

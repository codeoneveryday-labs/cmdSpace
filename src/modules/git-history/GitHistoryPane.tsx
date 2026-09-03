import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { GitCommitFileChange, GitLogEntry } from "@/modules/ai/lib/native";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MAX_VISIBLE_LANES, railWidth } from "./GraphRail";
import { GitCommitDetail } from "./GitCommitDetail";
import { GitCommitRow } from "./GitCommitRow";
import { filterGitCommits } from "./lib/gitHistoryModel";
import { useGitHistoryFiles } from "./useGitHistoryFiles";
import { useGitHistoryData } from "./useGitHistoryData";
import { useGitHistoryInfiniteScroll } from "./useGitHistoryInfiniteScroll";
import { useGitHistoryGraph } from "./useGitHistoryGraph";

const RAIL_RESERVED_PX = railWidth(MAX_VISIBLE_LANES);
// rail | sha | subject(capped) | spacer(absorbs slack) | author(hugs) | date | changes
const GRID_TEMPLATE = `${RAIL_RESERVED_PX + 4}px 60px minmax(0, 560px) minmax(12px, 1fr) minmax(140px, max-content) 96px 116px`;

const ROW_HEIGHT = 32;
const TABLE_HEADER_HEIGHT = 24;

type CommitFileDiffOpenInput = {
  repoRoot: string;
  sha: string;
  shortSha: string;
  subject: string;
  path: string;
  originalPath: string | null;
};

export type GitHistorySearchHandle = {
  setQuery: (query: string) => void;
  clearQuery: () => void;
};

type Props = {
  repoRoot: string;
  onOpenCommitFile: (input: CommitFileDiffOpenInput) => void;
  /** Lets the header search bar drive commit filtering for the active pane. */
  onSearchHandle?: (handle: GitHistorySearchHandle | null) => void;
};

export function GitHistoryPane({
  repoRoot,
  onOpenCommitFile,
  onSearchHandle,
}: Props) {
  const {
    commits,
    loadStatus,
    error,
    endReached,
    remoteWeb,
    loadInitial,
    loadMore,
  } = useGitHistoryData(repoRoot);
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput.trim());
  // Require at least 2 characters before filtering to avoid noisy single-char
  // matches and pointless full-list scans on every keystroke.
  const activeSearch = deferredSearch.length >= 2 ? deferredSearch : "";

  useEffect(() => {
    onSearchHandle?.({
      setQuery: (query: string) => setSearchInput(query),
      clearQuery: () => setSearchInput(""),
    });
    return () => onSearchHandle?.(null);
  }, [onSearchHandle]);
  const [openAnchor, setOpenAnchor] = useState<{
    sha: string;
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);
  const { cacheRef: filesCacheRef, filesTick, clearCache, fetchFiles } =
    useGitHistoryFiles(repoRoot);

  const scrollRef = useRef<HTMLDivElement>(null);
  const { graphByCommit, maxLaneCount } = useGitHistoryGraph(commits);
  const gridTemplate = GRID_TEMPLATE;

  const filtered = useMemo(
    () => filterGitCommits(commits, activeSearch),
    [commits, activeSearch],
  );

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => filtered[index]?.sha ?? index,
  });

  const handleScroll = useGitHistoryInfiniteScroll({
    scrollRef,
    activeSearch,
    commitCount: commits.length,
    loadStatus,
    endReached,
    loadMore,
    onScrollInteraction: () => setOpenAnchor((previous) => (previous ? null : previous)),
  });

  const handleRefresh = useCallback(() => {
    clearCache();
    void loadInitial();
  }, [clearCache, loadInitial]);

  const handleRowClick = useCallback(
    (sha: string, event: React.MouseEvent<HTMLElement>) => {
      if (openAnchor?.sha === sha) {
        setOpenAnchor(null);
        return;
      }
      // Anchor at the cursor so the popover opens where the user clicked,
      // but clamp X so it never gets pushed off-screen on the right.
      const POPOVER_WIDTH = 420;
      const PADDING = 16;
      const maxLeft = window.innerWidth - POPOVER_WIDTH - PADDING;
      const left = Math.max(PADDING, Math.min(event.clientX, maxLeft));
      setOpenAnchor({
        sha,
        top: event.clientY,
        left,
        width: 1,
        height: 1,
      });
      void fetchFiles(sha);
    },
    [fetchFiles, openAnchor?.sha],
  );

  const closePopover = useCallback(() => setOpenAnchor(null), []);

  const openFilesEntry = useMemo(() => {
    if (!openAnchor) return null;
    return filesCacheRef.current.get(openAnchor.sha) ?? null;
  }, [openAnchor, filesTick]);

  const handleFileOpen = useCallback(
    (commit: GitLogEntry, file: GitCommitFileChange) => {
      onOpenCommitFile({
        repoRoot,
        sha: commit.sha,
        shortSha: commit.shortSha,
        subject: commit.subject,
        path: file.path,
        originalPath: file.originalPath,
      });
      setOpenAnchor(null);
    },
    [onOpenCommitFile, repoRoot],
  );

  const copyToClipboard = useCallback(async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      /* noop */
    }
  }, []);

  return (
    <TooltipProvider delayDuration={500} skipDelayDuration={200}>
      <div className="flex h-full min-h-0 flex-col bg-background [contain:layout_style]">
        {loadStatus === "initial" && commits.length === 0 ? (
          <CenterPlaceholder>
            <Spinner className="h-4 w-3" />
            <span className="text-[11.5px] text-muted-foreground">
              Loading commits…
            </span>
          </CenterPlaceholder>
        ) : loadStatus === "error" && commits.length === 0 ? (
          <CenterPlaceholder>
            <div className="text-[13px] font-medium">
              Could not load history
            </div>
            <div className="max-w-md text-[11px] leading-relaxed text-muted-foreground">
              {error ?? "Unknown error"}
            </div>
            <Button size="sm" onClick={handleRefresh}>
              Retry
            </Button>
          </CenterPlaceholder>
        ) : commits.length === 0 ? (
          <CenterPlaceholder>
            <div className="text-[13px] font-medium">No commits yet</div>
            <div className="max-w-md text-[11px] leading-relaxed text-muted-foreground">
              This branch has no commits.
            </div>
          </CenterPlaceholder>
        ) : (
          <>
            <div
              className="grid shrink-0 items-center gap-3 border-b border-border/40 bg-card/55 pr-3 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70"
              style={{
                height: TABLE_HEADER_HEIGHT,
                gridTemplateColumns: gridTemplate,
              }}
            >
              <div />
              <div className="pl-px">SHA</div>
              <div className="min-w-0">Subject</div>
              <div />
              <div className="ml-2">Author</div>
              <div className="text-right">Date</div>
              <div className="text-right">Changes</div>
            </div>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]"
            >
              <div
                style={{
                  height: virtualizer.getTotalSize(),
                  position: "relative",
                  width: "100%",
                }}
              >
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const commit = filtered[virtualRow.index];
                  if (!commit) return null;
                  return (
                    <div
                      key={virtualRow.key}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <GitCommitRow
                        commit={commit}
                        query={activeSearch}
                        active={openAnchor?.sha === commit.sha}
                        graphRow={graphByCommit.get(commit.sha) ?? null}
                        maxLaneCount={maxLaneCount}
                        gridTemplate={gridTemplate}
                        onClick={handleRowClick}
                      />
                    </div>
                  );
                })}
              </div>

              {loadStatus === "more" ? (
                <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-muted-foreground">
                  <Spinner className="h-4 w-3" />
                  Loading more…
                </div>
              ) : null}
              {endReached && !activeSearch ? (
                <div className="py-3 text-center text-[10.5px] text-muted-foreground/65">
                  End of history
                </div>
              ) : null}
              {loadStatus === "error" && commits.length > 0 ? (
                <div className="flex items-center justify-center gap-2 py-3 text-[11px] text-destructive">
                  {error ?? "Failed to load more"}
                  <Button
                    size="xs"
                    variant="ghost"
                    className="h-6 cursor-pointer text-[11px]"
                    onClick={() => void loadMore()}
                  >
                    Retry
                  </Button>
                </div>
              ) : null}
            </div>
          </>
        )}

        <Popover
          open={!!openAnchor}
          onOpenChange={(next) => {
            if (!next) closePopover();
          }}
        >
          {typeof document !== "undefined"
            ? createPortal(
                <PopoverAnchor asChild>
                  <div
                    aria-hidden
                    style={{
                      position: "fixed",
                      top: openAnchor?.top ?? -9999,
                      left: openAnchor?.left ?? -9999,
                      width: openAnchor?.width ?? 0,
                      height: openAnchor?.height ?? 0,
                      pointerEvents: "none",
                    }}
                  />
                </PopoverAnchor>,
                document.body,
              )
            : null}
          <PopoverContent
            side="bottom"
            align="start"
            sideOffset={4}
            alignOffset={0}
            collisionPadding={16}
            avoidCollisions
            onOpenAutoFocus={(e) => e.preventDefault()}
            className="flex w-[420px] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden rounded-xl p-0 shadow-xl"
          >
            {openAnchor
              ? (() => {
                  const commit = commits.find((c) => c.sha === openAnchor.sha);
                  if (!commit) return null;
                  return (
                    <GitCommitDetail
                      commit={commit}
                      filesEntry={openFilesEntry}
                      remoteWeb={remoteWeb}
                      onCopySha={copyToClipboard}
                      onOpenFile={handleFileOpen}
                      onRetryFiles={() => void fetchFiles(openAnchor.sha)}
                    />
                  );
                })()
              : null}
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  );
}

function CenterPlaceholder({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      {children}
    </div>
  );
}

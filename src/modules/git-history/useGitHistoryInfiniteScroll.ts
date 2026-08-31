import { useCallback, useEffect, type RefObject } from "react";

const NEAR_BOTTOM_PX = 240;

export function useGitHistoryInfiniteScroll({
  scrollRef,
  activeSearch,
  commitCount,
  loadStatus,
  endReached,
  loadMore,
  onScrollInteraction,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  activeSearch: string;
  commitCount: number;
  loadStatus: "initial" | "idle" | "more" | "error";
  endReached: boolean;
  loadMore: () => Promise<unknown>;
  onScrollInteraction: () => void;
}) {
  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    onScrollInteraction();
    if (activeSearch) return;
    const remaining =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining < NEAR_BOTTOM_PX) void loadMore();
  }, [activeSearch, loadMore, onScrollInteraction, scrollRef]);

  useEffect(() => {
    if (loadStatus !== "idle" || endReached || activeSearch || commitCount === 0) {
      return;
    }
    const element = scrollRef.current;
    if (!element) return;
    const scrollable = element.scrollHeight - element.clientHeight;
    if (scrollable > NEAR_BOTTOM_PX) return;
    const id = window.setTimeout(() => void loadMore(), 0);
    return () => window.clearTimeout(id);
  }, [activeSearch, commitCount, endReached, loadMore, loadStatus, scrollRef]);

  return handleScroll;
}

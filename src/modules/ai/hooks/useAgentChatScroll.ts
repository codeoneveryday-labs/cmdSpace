import { useCallback, useEffect, useState, type RefObject } from "react";

export function useAgentChatScroll({
  outlineItems,
  maxOutlineLines,
  viewportRef,
  scrollDependency,
}: {
  outlineItems: Array<{ id: string; text: string }>;
  maxOutlineLines: number;
  viewportRef: RefObject<HTMLDivElement | null>;
  scrollDependency: unknown;
}) {
  const [nearBottom, setNearBottom] = useState(true);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState<number | null>(null);

  const scrollToLatest = useCallback((viewport: HTMLDivElement | null) => {
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const viewport = event.currentTarget;
      setNearBottom(
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 72,
      );
      const anchor = viewport.getBoundingClientRect().top + 120;
      let nextIndex: number | null = null;
      outlineItems.forEach((item, index) => {
        const node = document.getElementById(`agent-chat-${item.id}`);
        if (node && node.getBoundingClientRect().top <= anchor) nextIndex = index;
      });
      setActiveHistoryIndex(nextIndex);
    },
    [outlineItems],
  );

  useEffect(() => {
    if (nearBottom) {
      scrollToLatest(viewportRef.current);
    }
  }, [nearBottom, outlineItems, scrollDependency, scrollToLatest, viewportRef]);

  const outlineWindow = (() => {
    const total = outlineItems.length;
    if (total <= maxOutlineLines) return { items: outlineItems, start: 0 };
    const active = activeHistoryIndex ?? total - 1;
    const start = Math.min(
      Math.max(0, active - Math.floor(maxOutlineLines / 2)),
      total - maxOutlineLines,
    );
    return {
      items: outlineItems.slice(start, start + maxOutlineLines),
      start,
    };
  })();

  return {
    nearBottom,
    activeHistoryIndex,
    outlineWindow,
    handleScroll,
    scrollToLatest,
  };
}

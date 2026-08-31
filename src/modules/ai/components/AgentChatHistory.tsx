import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ComponentProps } from "react";
import { useMemo, useRef } from "react";
import { useAgentChatScroll } from "../hooks/useAgentChatScroll";
import { buildAgentChatOutlineItems } from "../lib/agentChatTimeline";
import { AgentChatOutlineRail } from "./AgentChatOutlineRail";
import { AgentEditCard } from "./AgentEditCard";
import { AgentTimeline } from "./AgentTimeline";

const MAX_OUTLINE_LINES = 80;

type Props = {
  timeline: ComponentProps<typeof AgentTimeline>;
  editFiles: ComponentProps<typeof AgentEditCard>["files"];
  onReviewEdits: () => void;
  onUndoEdits: () => void;
};

export function AgentChatHistory({
  timeline,
  editFiles,
  onReviewEdits,
  onUndoEdits,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const outlineItems = useMemo(
    () => buildAgentChatOutlineItems(timeline.items),
    [timeline.items],
  );
  const {
    nearBottom,
    activeHistoryIndex,
    outlineWindow,
    handleScroll,
    scrollToLatest,
  } = useAgentChatScroll({
    outlineItems,
    maxOutlineLines: MAX_OUTLINE_LINES,
    viewportRef: scrollRef,
    scrollDependency: timeline.items,
  });

  return (
    <div className="relative min-h-0 flex-1">
      <AgentChatOutlineRail
        prompts={outlineWindow.items}
        activeIndex={
          activeHistoryIndex === null
            ? null
            : activeHistoryIndex - outlineWindow.start
        }
        onJump={(id) =>
          document
            .getElementById(`agent-chat-${id}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
        }
      />
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full min-h-0 overflow-y-auto px-5 py-9 pl-14 sm:px-10 sm:pl-16"
      >
        <AgentTimeline {...timeline} />
        {editFiles.length > 0 ? (
          <AgentEditCard
            files={editFiles}
            onReview={onReviewEdits}
            onUndo={onUndoEdits}
          />
        ) : null}
      </div>
      {!nearBottom ? (
        <button
          type="button"
          onClick={() => scrollToLatest(scrollRef.current)}
          aria-label="Scroll to latest message"
          className="absolute bottom-4 left-1/2 z-20 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md hover:text-foreground"
        >
          <HugeiconsIcon icon={ArrowDown01Icon} size={16} strokeWidth={2} />
        </button>
      ) : null}
    </div>
  );
}

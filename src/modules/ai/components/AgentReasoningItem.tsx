import type { AgentChatTimelineItem } from "@/modules/ai/lib/agentChatTimeline";

export function AgentReasoningItem({
  item,
}: {
  item: Extract<AgentChatTimelineItem, { kind: "reasoning" }>;
}) {
  return (
    <details className="group text-sm text-muted-foreground">
      <summary className="cursor-pointer select-none text-xs font-medium">
        Reasoning
      </summary>
      <p className="mt-2 whitespace-pre-wrap border-l border-border pl-3 leading-6">
        {item.text}
      </p>
    </details>
  );
}

import type { AgentChatTimelineItem } from "@/modules/ai/lib/agentChatTimeline";

export function AgentToolTimelineItem({
  item,
}: {
  item: Extract<AgentChatTimelineItem, { kind: "tool" }>;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/35 px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-medium text-foreground">{item.name}</span>
        <span className="text-muted-foreground">{item.status}</span>
      </div>
      {item.detail ? (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-5 text-muted-foreground">
          {item.detail}
        </pre>
      ) : null}
    </div>
  );
}

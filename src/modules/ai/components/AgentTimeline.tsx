import { AgentCliIcon } from "@/modules/terminal/AgentCliIcon";
import { AgentStateDot } from "@/modules/terminal/AgentStateDot";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import {
  buildAgentChatForkHistory,
  type AgentChatTimelineItem,
} from "@/modules/ai/lib/agentChatTimeline";
import { AgentAssistantMessage } from "./AgentAssistantMessage";
import { AgentReasoningItem } from "./AgentReasoningItem";
import { AgentToolTimelineItem } from "./AgentToolTimelineItem";
import { AgentUserPrompt } from "./AgentUserPrompt";

export function AgentTimeline({
  items,
  provider,
  agentName,
  chatTextStyle,
  status,
  error,
  usage,
  onRewrite,
  onFork,
}: {
  items: AgentChatTimelineItem[];
  provider: CliAgent;
  agentName: string;
  chatTextStyle: React.CSSProperties;
  status: "idle" | "running" | "error";
  error: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  onRewrite: (id: string, text: string) => Promise<unknown>;
  onFork: (destination: "tab" | "workspace", history: ReturnType<typeof buildAgentChatForkHistory>) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-7">
      {items.length === 0 ? (
        <div className="py-14 text-center">
          <AgentCliIcon agent={provider} size="md" />
          <h3 className="mt-4 text-sm font-medium text-foreground">Start a {agentName} session</h3>
          <p className="mt-1 text-sm text-muted-foreground">Messages and tool activity will appear here.</p>
        </div>
      ) : (
        items.map((item) => {
          if (item.kind === "user") {
            return <div key={item.id} id={`agent-chat-${item.id}`} style={chatTextStyle}><AgentUserPrompt item={item} canEdit onEdit={(text) => onRewrite(item.id, text)} /></div>;
          }
          if (item.kind === "assistant") {
            const history = buildAgentChatForkHistory(items, item.id);
            return <AgentAssistantMessage key={item.id} item={item} style={chatTextStyle} onFork={(destination) => onFork(destination, history)} />;
          }
          if (item.kind === "reasoning") return <AgentReasoningItem key={item.id} item={item} />;
          return <AgentToolTimelineItem key={item.id} item={item} />;
        })
      )}
      {status === "running" ? <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status" aria-label="Agent is responding"><AgentStateDot state="working" /><span>Agent is responding</span></div> : null}
      {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
      {usage ? <p className="text-[11px] tabular-nums text-muted-foreground">{usage.inputTokens.toLocaleString()} input · {usage.outputTokens.toLocaleString()} output tokens</p> : null}
    </div>
  );
}

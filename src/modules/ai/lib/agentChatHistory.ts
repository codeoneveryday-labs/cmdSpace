import { LazyStore } from "@tauri-apps/plugin-store";
import { sanitizeAgentChatTimeline, type AgentChatTimelineState } from "./agentChatTimeline";

const store = new LazyStore("cmdspace-agent-chat-history.json", {
  defaults: {},
  autoSave: 200,
});

function key(workspaceId: string): string {
  return `workspace:${workspaceId}`;
}

export async function loadAgentChatHistory(
  workspaceId: string,
): Promise<AgentChatTimelineState | null> {
  const saved = await store.get<AgentChatTimelineState>(key(workspaceId));
  return saved ? sanitizeAgentChatTimeline(saved) : null;
}

export async function saveAgentChatHistory(
  workspaceId: string,
  state: AgentChatTimelineState,
): Promise<void> {
  await store.set(key(workspaceId), {
    ...state,
    runtimeSessionId: null,
    status: state.status === "error" ? "error" : "idle",
  });
  await store.save();
}

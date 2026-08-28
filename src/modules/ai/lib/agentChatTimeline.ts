export type AgentChatEvent =
  | { type: "session"; nativeId: string }
  | { type: "user"; text: string }
  | { type: "assistant"; text: string }
  | { type: "reasoning"; text: string }
  | { type: "tool"; id: string; name: string; status: string; detail: string | null }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "error"; message: string }
  | { type: "done" };

export type AgentChatHistoryAttachment = {
  kind: "chat-history";
  title: "Chat history";
  subtitle: "Previous conversation";
  context: string;
};

export type AgentChatTimelineItem =
  | { id: string; kind: "user"; text: string; sentAt?: number; attachments?: AgentChatHistoryAttachment[] }
  | { id: string; kind: "assistant"; text: string; workedMs?: number }
  | { id: string; kind: "reasoning"; text: string }
  | { id: string; kind: "tool"; name: string; status: string; detail: string | null };

export type AgentChatTimelineState = {
  runtimeSessionId: string | null;
  nativeSessionId: string | null;
  status: "idle" | "running" | "error";
  error: string | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  turnStartedAt?: number | null;
  items: AgentChatTimelineItem[];
};

export function buildAgentChatOutlineItems(
  items: readonly AgentChatTimelineItem[],
): Array<{ id: string; text: string }> {
  const result: Array<{ id: string; text: string }> = [];
  let currentPrompt: { id: string; text: string } | null = null;
  const indexedPromptIds = new Set<string>();
  for (const item of items) {
    if (item.kind === "user") currentPrompt = { id: item.id, text: item.text };
    if (item.kind === "assistant" && currentPrompt && !indexedPromptIds.has(currentPrompt.id)) {
      indexedPromptIds.add(currentPrompt.id);
      result.push(currentPrompt);
    }
  }
  return result;
}

export function sanitizeAgentChatText(text: string): string {
  if (!text) return text;
  const replacementCount = (text.match(/\uFFFD/g) ?? []).length;
  const controlCount = (text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) ?? []).length;
  const suspicious = replacementCount + controlCount;
  if (suspicious >= 4 && suspicious / Math.max(text.length, 1) > 0.01) {
    return "[Image attachment omitted from legacy history]";
  }
  return text;
}

export function sanitizeAgentChatTimeline(state: AgentChatTimelineState): AgentChatTimelineState {
  return {
    ...state,
    items: state.items.map((item) => {
      if ("text" in item) return { ...item, text: sanitizeAgentChatText(item.text) };
      return { ...item, detail: item.detail ? sanitizeAgentChatText(item.detail) : item.detail };
    }),
  };
}

export function createAgentChatTimeline(
  runtimeSessionId: string | null,
  nativeSessionId: string | null = null,
): AgentChatTimelineState {
  return {
    runtimeSessionId,
    nativeSessionId,
    status: "idle",
    error: null,
    usage: null,
    turnStartedAt: null,
    items: [],
  };
}

function nextItemId(state: AgentChatTimelineState): string {
  return `item-${state.items.length + 1}`;
}

export function submitAgentChatPrompt(
  state: AgentChatTimelineState,
  text: string,
  attachments: AgentChatHistoryAttachment[] = [],
): AgentChatTimelineState {
  return {
    ...state,
    status: "running",
    error: null,
    turnStartedAt: Date.now(),
    items: [...state.items, {
      id: nextItemId(state),
      kind: "user",
      text,
      sentAt: Date.now(),
      ...(attachments.length > 0 ? { attachments } : {}),
    }],
  };
}

export function editAgentChatPrompt(
  state: AgentChatTimelineState,
  itemId: string,
  text: string,
): AgentChatTimelineState {
  return {
    ...state,
    status: "running",
    error: null,
    turnStartedAt: Date.now(),
    items: state.items.map((item) =>
      item.kind === "user" && item.id === itemId ? { ...item, text } : item,
    ),
  };
}

export function buildAgentChatForkHistory(
  items: readonly AgentChatTimelineItem[],
  boundaryId: string,
): AgentChatHistoryAttachment {
  const boundary = items.findIndex((item) => item.id === boundaryId);
  const history = (boundary < 0 ? items : items.slice(0, boundary + 1))
    .flatMap((item) => item.kind === "user"
      ? [`User: ${item.text}`]
      : item.kind === "assistant"
        ? [`Assistant: ${item.text}`]
        : [])
    .join("\n\n");
  return {
    kind: "chat-history",
    title: "Chat history",
    subtitle: "Previous conversation",
    context: history,
  };
}

export function setAgentChatRuntimeSession(
  state: AgentChatTimelineState,
  runtimeSessionId: string,
): AgentChatTimelineState {
  return { ...state, runtimeSessionId };
}

export function buildAgentChatReplayPrompt(
  state: AgentChatTimelineState,
  prompt: string,
): string {
  const conversation = state.items.flatMap((item) => {
    if (item.kind === "user") return [`User: ${item.text}`];
    if (item.kind === "assistant") return [`Assistant: ${item.text}`];
    return [];
  });
  if (conversation.length === 0) return prompt;
  return [
    "Continue this coding-agent conversation in the same workspace.",
    ...conversation,
    `User: ${prompt}`,
  ].join("\n\n");
}

export function applyAgentChatEvent(
  state: AgentChatTimelineState,
  event: AgentChatEvent,
): AgentChatTimelineState {
  if (event.type === "session") return { ...state, nativeSessionId: event.nativeId };
  if (event.type === "usage") {
    return {
      ...state,
      usage: { inputTokens: event.inputTokens, outputTokens: event.outputTokens },
    };
  }
  if (event.type === "error") {
    return { ...state, status: "error", error: event.message };
  }
  if (event.type === "done") {
    if (state.status === "error") return state;
    const workedMs = state.turnStartedAt === null || state.turnStartedAt === undefined
      ? undefined
      : Math.max(0, Date.now() - state.turnStartedAt);
    const lastAssistantIndex = state.items.map((item) => item.kind).lastIndexOf("assistant");
    const items = lastAssistantIndex < 0 || workedMs === undefined
      ? state.items
      : state.items.map((item, index) => index === lastAssistantIndex && item.kind === "assistant"
        ? { ...item, workedMs }
        : item);
    return { ...state, status: "idle", turnStartedAt: null, items };
  }
  if (event.type === "user") {
    return {
      ...state,
      items: [...state.items, { id: nextItemId(state), kind: "user", text: sanitizeAgentChatText(event.text) }],
    };
  }
  if (event.type === "tool") {
    const existing = state.items.findIndex(
      (item) => item.kind === "tool" && item.id === event.id,
    );
    const item: AgentChatTimelineItem = {
      id: event.id,
      kind: "tool",
      name: event.name,
      status: event.status,
      detail: event.detail ? sanitizeAgentChatText(event.detail) : event.detail,
    };
    if (existing < 0) return { ...state, items: [...state.items, item] };
    const items = [...state.items];
    items[existing] = item;
    return { ...state, items };
  }
  const kind = event.type;
  const eventText = sanitizeAgentChatText(event.text);
  const last = state.items[state.items.length - 1];
  if (last && last.kind === kind && "text" in last) {
    return {
      ...state,
      items: [
        ...state.items.slice(0, -1),
        { ...last, text: sanitizeAgentChatText(last.text + eventText) },
      ],
    };
  }
  return {
    ...state,
    items: [...state.items, { id: nextItemId(state), kind, text: eventText }],
  };
}

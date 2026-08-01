import { Chat, type UIMessage } from "@ai-sdk/react";
import {
  type ChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { create } from "zustand";
import {
  DEFAULT_MODEL_ID,
  getModel,
  providerNeedsKey,
  type ModelId,
  type ProviderId,
} from "../config";
import { usePreferencesStore } from "@/modules/settings/preferences";
import { BUILTIN_AGENTS, DEFAULT_AGENT_ID } from "../lib/agents";
import { useAgentsStore } from "./agentsStore";
import { usePlanStore } from "./planStore";
import { useTodosStore } from "./todoStore";
import type { AgentUsage } from "../lib/agent";
import { EMPTY_PROVIDER_KEYS, type ProviderKeys } from "../lib/keyring";
import {
  deleteSessionData,
  deriveTitle,
  loadAll,
  loadMessages,
  newSessionId,
  saveActiveId,
  saveMessages,
  saveSessionsList,
  type SessionMeta,
} from "../lib/sessions";
import { pushRecentModel } from "../lib/modelPrefs";
import { createContextAwareTransport } from "../lib/transport";
import type { ToolContext } from "../tools/tools";

type Live = {
  getCwd: () => string | null;
  getTerminalContext: () => string | null;
  isActiveTerminalPrivate: () => boolean;
  injectIntoActivePty: (text: string) => boolean;
  getActiveTerminalAgents: ToolContext["getActiveTerminalAgents"];
  getActiveTerminalPaneIndex: ToolContext["getActiveTerminalPaneIndex"];
  dispatchPromptsToTerminals: ToolContext["dispatchPromptsToTerminals"];
  getWorkspaceRoot: () => string | null;
  getActiveFile: () => string | null;
  openPreview: (url: string) => boolean;
  createWorkspace: ToolContext["createWorkspace"];
  openBrowser: (url: string) => boolean;
  openArchitecture: () => boolean;
  createMindMap: ToolContext["createMindMap"];
};

export type AgentRunStatus =
  | "idle"
  | "thinking"
  | "streaming"
  | "awaiting-approval"
  | "error";

export type AgentMeta = {
  status: AgentRunStatus;
  step: string | null;
  approvalsPending: number;
  error: string | null;
  tokens: AgentUsage;
  lastInputTokens: number;
  lastCachedTokens: number;
  hitStepCap: boolean;
  compactionNotice: { droppedCount: number; at: number } | null;
};

const ZERO_USAGE: AgentUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cachedInputTokens: 0,
};

const IDLE_META: AgentMeta = {
  status: "idle",
  step: null,
  approvalsPending: 0,
  error: null,
  tokens: ZERO_USAGE,
  lastInputTokens: 0,
  lastCachedTokens: 0,
  hitStepCap: false,
  compactionNotice: null,
};

export type MiniState = {
  open: boolean;
};

export type PendingSelection = {
  id: string;
  text: string;
  source: "terminal" | "editor";
};

export type ApprovalResponder = (
  approvalId: string,
  approved: boolean,
) => void;

type StoreState = {
  live: Live;
  setLive: (live: Live) => void;

  /**
   * Set by AgentRunBridge each render. Lets surfaces outside the chat hook
   * tree (e.g. the AI diff tab in the editor area) resolve a pending tool
   * approval through the active session's `addToolApprovalResponse`.
   */
  approvalResponder: ApprovalResponder | null;
  setApprovalResponder: (fn: ApprovalResponder | null) => void;
  respondToApproval: (approvalId: string, approved: boolean) => void;

  apiKeys: ProviderKeys;
  setApiKeys: (keys: ProviderKeys) => void;
  setApiKey: (provider: ProviderId, key: string | null) => void;

  selectedModelId: ModelId;
  setSelectedModelId: (id: ModelId) => void;

  mini: MiniState;
  openMini: () => void;
  closeMini: () => void;
  toggleMini: () => void;

  panelOpen: boolean;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;

  focusSignal: number;
  pendingPrefill: string | null;
  focusInput: (prefill?: string | null) => void;
  consumePrefill: () => string | null;

  pendingSelections: PendingSelection[];
  attachSelection: (text: string, source: "terminal" | "editor") => void;
  consumeSelections: () => PendingSelection[];

  agentMeta: AgentMeta;
  patchAgentMeta: (patch: Partial<AgentMeta>) => void;
  resetAgentMeta: () => void;

  // Sessions
  sessionScopeKey: string;
  sessionsHydrated: boolean;
  sessions: SessionMeta[];
  activeSessionId: string | null;
  hydrateSessions: (scopeKey?: string) => Promise<void>;
  newSession: () => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  /** Persist messages of a session and bump its updatedAt + auto-title. */
  persistMessages: (id: string, messages: UIMessage[]) => void;
};

const NOOP_LIVE: Live = {
  getCwd: () => null,
  getTerminalContext: () => null,
  isActiveTerminalPrivate: () => false,
  injectIntoActivePty: () => false,
  getActiveTerminalAgents: () => [],
  getActiveTerminalPaneIndex: () => null,
  dispatchPromptsToTerminals: () => [],
  getWorkspaceRoot: () => null,
  getActiveFile: () => null,
  openPreview: () => false,
  createWorkspace: async () => ({ terminalCount: 0 }),
  openBrowser: () => false,
  openArchitecture: () => false,
  createMindMap: async () => ({ tabId: -1, nodeCount: 0, edgeCount: 0 }),
};

const CHATS_LRU_CAP = 8;
const DEFAULT_SESSION_SCOPE = "global";
const chatCacheKey = (scopeKey: string, sessionId: string) =>
  `${scopeKey}::${sessionId}`;
const chats = new Map<string, Chat<UIMessage>>();

function touchChat(scopeKey: string, id: string, c: Chat<UIMessage>) {
  const key = chatCacheKey(scopeKey, id);
  if (chats.has(key)) chats.delete(key);
  chats.set(key, c);
  while (chats.size > CHATS_LRU_CAP) {
    const oldest = chats.keys().next().value;
    if (!oldest || oldest === key) break;
    const state = useChatStore.getState();
    if (oldest === chatCacheKey(state.sessionScopeKey, state.activeSessionId ?? "")) break;
    flushPersistEntry(oldest);
    void chats.get(oldest)?.stop();
    chats.delete(oldest);
  }
}
// Initial messages for a session, populated at hydration time and consumed
// when the matching Chat is constructed.
const seedMessages = new Map<string, UIMessage[]>();

// Trailing debounce for per-token message persistence. Streaming fires
// `persistMessages` on every token; without this we'd JSON-serialize the
// full message array and round-trip to the store plugin per token, which
// stalls the UI. Flush on idle (status transition) via `flushPersist`.
const PERSIST_DEBOUNCE_MS = 300;
const pendingPersist = new Map<
  string,
  {
    scopeKey: string;
    sessionId: string;
    latest: UIMessage[];
    timer: ReturnType<typeof setTimeout>;
  }
>();

function flushPersistEntry(id: string) {
  const entry = pendingPersist.get(id);
  if (!entry) return;
  clearTimeout(entry.timer);
  pendingPersist.delete(id);
  void saveMessages(entry.scopeKey, entry.sessionId, entry.latest);
}

export function flushPersist(id?: string): void {
  if (id) {
    const scopeKey = useChatStore.getState().sessionScopeKey;
    flushPersistEntry(chatCacheKey(scopeKey, id));
    return;
  }
  for (const key of Array.from(pendingPersist.keys())) flushPersistEntry(key);
}

function makeChat(scopeKey: string, sessionId: string): Chat<UIMessage> {
  const readCache = new Map<string, { size: number; hash: number }>();
  const toolContext: ToolContext = {
    getCwd: () => useChatStore.getState().live.getCwd(),
    getWorkspaceRoot: () =>
      useChatStore.getState().live.getWorkspaceRoot(),
    getTerminalContext: () =>
      useChatStore.getState().live.getTerminalContext(),
    isActiveTerminalPrivate: () =>
      useChatStore.getState().live.isActiveTerminalPrivate(),
    injectIntoActivePty: (text) =>
      useChatStore.getState().live.injectIntoActivePty(text),
    getActiveTerminalAgents: () =>
      useChatStore.getState().live.getActiveTerminalAgents(),
    getActiveTerminalPaneIndex: () =>
      useChatStore.getState().live.getActiveTerminalPaneIndex(),
    dispatchPromptsToTerminals: (assignments) =>
      useChatStore.getState().live.dispatchPromptsToTerminals(assignments),
    openPreview: (url) => useChatStore.getState().live.openPreview(url),
    createWorkspace: (input) =>
      useChatStore.getState().live.createWorkspace(input),
    openBrowser: (url) => useChatStore.getState().live.openBrowser(url),
    openArchitecture: () => useChatStore.getState().live.openArchitecture(),
    createMindMap: (input) => useChatStore.getState().live.createMindMap(input),
    readCache,
    getSessionId: () => sessionId,
  };

  const transport = createContextAwareTransport({
    getKeys: () => useChatStore.getState().apiKeys,
    toolContext,
    getModelId: () => useChatStore.getState().selectedModelId,
    getCustomInstructions: () =>
      usePreferencesStore.getState().customInstructions,
    getAgentPersona: () => {
      const { activeId, customAgents } = useAgentsStore.getState();
      const all = [...BUILTIN_AGENTS, ...customAgents];
      const a =
        all.find((x) => x.id === activeId) ??
        all.find((x) => x.id === DEFAULT_AGENT_ID) ??
        BUILTIN_AGENTS[0];
      return { name: a.name, instructions: a.instructions };
    },
    getLive: () => {
      const live = useChatStore.getState().live;
      return {
        cwd: live.getCwd(),
        terminalPrivate: live.isActiveTerminalPrivate(),
        workspaceRoot: live.getWorkspaceRoot(),
        activeFile: live.getActiveFile(),
      };
    },
    getPlanMode: () => usePlanStore.getState().active,
    getLmstudioBaseURL: () => usePreferencesStore.getState().lmstudioBaseURL,
    getLmstudioModelId: () => usePreferencesStore.getState().lmstudioModelId,
    getMlxBaseURL: () => usePreferencesStore.getState().mlxBaseURL,
    getMlxModelId: () => usePreferencesStore.getState().mlxModelId,
    getOllamaBaseURL: () => usePreferencesStore.getState().ollamaBaseURL,
    getOllamaModelId: () => usePreferencesStore.getState().ollamaModelId,
    getOpenaiCompatibleBaseURL: () =>
      usePreferencesStore.getState().openaiCompatibleBaseURL,
    getOpenaiCompatibleModelId: () =>
      usePreferencesStore.getState().openaiCompatibleModelId,
    getOpenaiCompatibleContextLimit: () =>
      usePreferencesStore.getState().openaiCompatibleContextLimit,
    onStep: (step) => {
      useChatStore.getState().patchAgentMeta({ step });
    },
    onCompact: (info) => {
      useChatStore.getState().patchAgentMeta({
        compactionNotice: { droppedCount: info.droppedCount, at: Date.now() },
      });
    },
    onFinishMeta: (info) => {
      useChatStore.getState().patchAgentMeta({ hitStepCap: info.hitStepCap });
    },
    onUsage: (delta) => {
      const cur = useChatStore.getState().agentMeta.tokens;
      useChatStore.getState().patchAgentMeta({
        tokens: {
          inputTokens: cur.inputTokens + delta.inputTokens,
          outputTokens: cur.outputTokens + delta.outputTokens,
          cachedInputTokens: cur.cachedInputTokens + delta.cachedInputTokens,
        },
        lastInputTokens: delta.lastInputTokens,
        lastCachedTokens: delta.lastCachedTokens,
      });
    },
  }) as unknown as ChatTransport<UIMessage>;

  const cacheKey = chatCacheKey(scopeKey, sessionId);
  const initialMessages = seedMessages.get(cacheKey);
  seedMessages.delete(cacheKey);

  return new Chat<UIMessage>({
    id: sessionId,
    transport,
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onError: (e) => {
      useChatStore.getState().patchAgentMeta({
        status: "error",
        error: e instanceof Error ? e.message : String(e),
      });
    },
  });
}

export const useChatStore = create<StoreState>((set, get) => ({
  live: NOOP_LIVE,
  setLive: (live) => set({ live }),

  approvalResponder: null,
  setApprovalResponder: (fn) => set({ approvalResponder: fn }),
  respondToApproval: (approvalId, approved) => {
    const fn = get().approvalResponder;
    if (fn) fn(approvalId, approved);
  },

  apiKeys: { ...EMPTY_PROVIDER_KEYS },
  setApiKeys: (keys) => set({ apiKeys: keys }),
  setApiKey: (provider, key) => {
    set({ apiKeys: { ...get().apiKeys, [provider]: key } });
  },

  selectedModelId: DEFAULT_MODEL_ID,
  setSelectedModelId: (id) => {
    set({ selectedModelId: id });
    void pushRecentModel(id);
  },

  mini: { open: false },
  openMini: () => set({ mini: { open: true } }),
  closeMini: () => set({ mini: { open: false } }),
  toggleMini: () => set((s) => ({ mini: { open: !s.mini.open } })),

  panelOpen: false,
  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  focusSignal: 0,
  pendingPrefill: null,
  focusInput: (prefill = null) =>
    set((s) => ({
      panelOpen: true,
      focusSignal: s.focusSignal + 1,
      pendingPrefill: prefill ?? null,
    })),
  consumePrefill: () => {
    const v = get().pendingPrefill;
    if (v != null) set({ pendingPrefill: null });
    return v;
  },

  pendingSelections: [],
  attachSelection: (text, source) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const id = `sel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({
      panelOpen: true,
      focusSignal: s.focusSignal + 1,
      pendingSelections: [...s.pendingSelections, { id, text: trimmed, source }],
    }));
  },
  consumeSelections: () => {
    const v = get().pendingSelections;
    if (v.length > 0) set({ pendingSelections: [] });
    return v;
  },

  agentMeta: IDLE_META,
  patchAgentMeta: (patch) =>
    set((s) => ({ agentMeta: { ...s.agentMeta, ...patch } })),
  resetAgentMeta: () => set({ agentMeta: IDLE_META }),

  sessionScopeKey: DEFAULT_SESSION_SCOPE,
  sessionsHydrated: false,
  sessions: [],
  activeSessionId: null,

  hydrateSessions: async (scopeKey = DEFAULT_SESSION_SCOPE) => {
    if (get().sessionsHydrated && get().sessionScopeKey === scopeKey) return;
    set({
      sessionsHydrated: false,
      sessionScopeKey: scopeKey,
      sessions: [],
      activeSessionId: null,
    });
    const { sessions } = await loadAll(scopeKey);
    if (get().sessionScopeKey !== scopeKey) return;

    // Reuse the most recent untitled "New chat" session if one exists from
    // the previous run — no point stacking empty placeholder sessions every
    // launch. Otherwise prepend a fresh one.
    const emptySessions = sessions.filter((session) => session.title === "New chat");
    const reusable = emptySessions[0] ?? null;
    const duplicateEmptySessions = emptySessions.slice(1);
    for (const duplicate of duplicateEmptySessions) {
      void deleteSessionData(scopeKey, duplicate.id);
    }
    let nextSessions: SessionMeta[];
    let freshId: string;
    if (reusable) {
      const duplicateIds = new Set(duplicateEmptySessions.map((session) => session.id));
      nextSessions = sessions.filter((session) => !duplicateIds.has(session.id));
      freshId = reusable.id;
    } else {
      freshId = newSessionId();
      const fresh: SessionMeta = {
        id: freshId,
        title: "New chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      nextSessions = [fresh, ...sessions];
      void saveSessionsList(scopeKey, nextSessions);
    }
    void saveActiveId(scopeKey, freshId);

    set({
      sessions: nextSessions,
      activeSessionId: freshId,
      sessionsHydrated: true,
    });
  },

  newSession: () => {
    const current = get().sessions.find(
      (session) => session.id === get().activeSessionId,
    );
    if (current && current.title === "New chat") return current.id;
    const id = newSessionId();
    const meta: SessionMeta = {
      id,
      title: "New chat",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const next = [meta, ...get().sessions];
    const scopeKey = get().sessionScopeKey;
    set({ sessions: next, activeSessionId: id, agentMeta: IDLE_META });
    void saveSessionsList(scopeKey, next);
    void saveActiveId(scopeKey, id);
    return id;
  },

  switchSession: (id) => {
    if (get().activeSessionId === id) return;
    if (!get().sessions.some((s) => s.id === id)) return;

    // Lazily seed the chat with persisted messages the first time we open
    // this session. Subsequent switches reuse the cached Chat instance.
    const scopeKey = get().sessionScopeKey;
    const cacheKey = chatCacheKey(scopeKey, id);
    const flip = () => {
      set({ activeSessionId: id, agentMeta: IDLE_META });
      void saveActiveId(scopeKey, id);
    };
    if (chats.has(cacheKey) || seedMessages.has(cacheKey)) {
      flip();
      return;
    }
    void loadMessages(scopeKey, id).then((m) => {
      if (m && m.length > 0 && !chats.has(cacheKey)) seedMessages.set(cacheKey, m);
      flip();
    });
  },

  deleteSession: (id) => {
    const scopeKey = get().sessionScopeKey;
    const cacheKey = chatCacheKey(scopeKey, id);
    const remaining = get().sessions.filter((s) => s.id !== id);
    chats.get(cacheKey)?.stop();
    chats.delete(cacheKey);
    seedMessages.delete(cacheKey);
    const pend = pendingPersist.get(cacheKey);
    if (pend) {
      clearTimeout(pend.timer);
      pendingPersist.delete(cacheKey);
    }
    void deleteSessionData(scopeKey, id);
    void useTodosStore.getState().clearSession(id);

    if (remaining.length === 0) {
      const fresh: SessionMeta = {
        id: newSessionId(),
        title: "New chat",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      set({ sessions: [fresh], activeSessionId: fresh.id });
      void saveSessionsList(scopeKey, [fresh]);
      void saveActiveId(scopeKey, fresh.id);
      return;
    }

    const wasActive = get().activeSessionId === id;
    const nextActive = wasActive ? remaining[0].id : get().activeSessionId;
    set({ sessions: remaining, activeSessionId: nextActive });
    void saveSessionsList(scopeKey, remaining);
    if (wasActive) void saveActiveId(scopeKey, nextActive);
  },

  renameSession: (id, title) => {
    const next = get().sessions.map((s) =>
      s.id === id ? { ...s, title, updatedAt: Date.now() } : s,
    );
    set({ sessions: next });
    void saveSessionsList(get().sessionScopeKey, next);
  },

  persistMessages: (id, messages) => {
    // Debounce the message-blob write so streaming doesn't pound the store.
    const scopeKey = get().sessionScopeKey;
    const cacheKey = chatCacheKey(scopeKey, id);
    const existing = pendingPersist.get(cacheKey);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      const entry = pendingPersist.get(cacheKey);
      if (!entry) return;
      pendingPersist.delete(cacheKey);
      void saveMessages(entry.scopeKey, entry.sessionId, entry.latest);
    }, PERSIST_DEBOUNCE_MS);
    pendingPersist.set(cacheKey, {
      scopeKey,
      sessionId: id,
      latest: messages,
      timer,
    });

    // Update zustand session list only when the derived title actually
    // changes — otherwise we'd rewrite the sessions array (and trigger
    // re-renders + a store write) on every token.
    const sessions = get().sessions;
    const meta = sessions.find((s) => s.id === id);
    if (!meta) return;
    const isUntitled = !meta.title || meta.title === "New chat";
    if (!isUntitled) return;
    const nextTitle = deriveTitle(messages);
    if (nextTitle === meta.title) return;
    const next = sessions.map((s) =>
      s.id === id ? { ...s, title: nextTitle, updatedAt: Date.now() } : s,
    );
    set({ sessions: next });
    void saveSessionsList(get().sessionScopeKey, next);
  },
}));

export function getAgentMeta(): AgentMeta {
  return useChatStore.getState().agentMeta;
}

export function getActiveProviderKey(): string | null {
  const { selectedModelId, apiKeys } = useChatStore.getState();
  return apiKeys[getModel(selectedModelId).provider] ?? null;
}

export function hasKeyForModel(modelId: ModelId): boolean {
  const { apiKeys } = useChatStore.getState();
  const provider = getModel(modelId).provider;
  return providerNeedsKey(provider) ? !!apiKeys[provider] : true;
}

export function getOrCreateChat(sessionId: string): Chat<UIMessage> {
  const scopeKey = useChatStore.getState().sessionScopeKey;
  const cacheKey = chatCacheKey(scopeKey, sessionId);
  const existing = chats.get(cacheKey);
  if (existing) {
    touchChat(scopeKey, sessionId, existing);
    return existing;
  }
  const c = makeChat(scopeKey, sessionId);
  touchChat(scopeKey, sessionId, c);
  return c;
}

export function getChat(sessionId?: string): Chat<UIMessage> | undefined {
  const state = useChatStore.getState();
  if (sessionId) return chats.get(chatCacheKey(state.sessionScopeKey, sessionId));
  const id = state.activeSessionId;
  return id ? chats.get(chatCacheKey(state.sessionScopeKey, id)) : undefined;
}

export async function sendMessage(text: string): Promise<boolean> {
  const state = useChatStore.getState();
  const sessionId = state.activeSessionId;
  if (!sessionId) return false;
  if (providerNeedsKey(getModel(state.selectedModelId).provider) && !getActiveProviderKey()) return false;
  const c = getOrCreateChat(sessionId);
  await c.sendMessage({ text });
  return true;
}

export function stop(): void {
  const state = useChatStore.getState();
  const id = state.activeSessionId;
  if (!id) return;
  void chats.get(chatCacheKey(state.sessionScopeKey, id))?.stop();
}

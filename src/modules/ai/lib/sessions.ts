import type { UIMessage } from "@ai-sdk/react";
import { LazyStore } from "@tauri-apps/plugin-store";

export type SessionMeta = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
};

const STORE_PATH = "cmdspace-ai-sessions.json";
const encodedScope = (scopeKey: string) => encodeURIComponent(scopeKey);
const sessionsKey = (scopeKey: string) => `sessions:${encodedScope(scopeKey)}`;
const activeKey = (scopeKey: string) => `activeId:${encodedScope(scopeKey)}`;
const messagesKey = (scopeKey: string, id: string) =>
  `messages:${encodedScope(scopeKey)}:${id}`;
const LEGACY_SESSIONS = "sessions";
const LEGACY_ACTIVE = "activeId";
const legacyMessagesKey = (id: string) => `messages:${id}`;

const store = new LazyStore(STORE_PATH, { defaults: {}, autoSave: 200 });

export type LoadedSessions = {
  sessions: SessionMeta[];
  activeId: string | null;
};

export async function loadAll(scopeKey: string): Promise<LoadedSessions> {
  // One IPC roundtrip via entries() rather than two parallel get()s. Per-
  // session messages are loaded lazily via `loadMessages` only when a
  // session is opened, so cold boot stays at a single store call.
  const entries = await store.entries();
  let sessions: SessionMeta[] | undefined;
  let activeId: string | null | undefined;
  for (const [k, v] of entries) {
    if (k === sessionsKey(scopeKey)) sessions = v as SessionMeta[];
    else if (k === activeKey(scopeKey)) activeId = v as string | null;
    else if (scopeKey === "global" && k === LEGACY_SESSIONS && !sessions) {
      sessions = v as SessionMeta[];
    } else if (scopeKey === "global" && k === LEGACY_ACTIVE && activeId == null) {
      activeId = v as string | null;
    }
  }
  return { sessions: sessions ?? [], activeId: activeId ?? null };
}

export async function loadMessages(
  scopeKey: string,
  id: string,
): Promise<UIMessage[] | null> {
  const namespaced = await store.get<UIMessage[]>(messagesKey(scopeKey, id));
  if (namespaced) return namespaced;
  if (scopeKey !== "global") return null;
  return (await store.get<UIMessage[]>(legacyMessagesKey(id))) ?? null;
}

export async function saveSessionsList(
  scopeKey: string,
  sessions: SessionMeta[],
): Promise<void> {
  await store.set(sessionsKey(scopeKey), sessions);
}

export async function saveActiveId(
  scopeKey: string,
  id: string | null,
): Promise<void> {
  await store.set(activeKey(scopeKey), id);
}

export async function saveMessages(
  scopeKey: string,
  id: string,
  messages: UIMessage[],
): Promise<void> {
  await store.set(messagesKey(scopeKey, id), messages);
}

export async function deleteSessionData(
  scopeKey: string,
  id: string,
): Promise<void> {
  await store.delete(messagesKey(scopeKey, id));
}

export function newSessionId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function deriveTitle(messages: UIMessage[]): string {
  for (const m of messages) {
    if (m.role !== "user") continue;
    for (const p of m.parts) {
      if (p.type !== "text") continue;
      const text = (p as { text: string }).text
        .replace(/<terminal-context[\s\S]*?<\/terminal-context>\s*/g, "")
        .replace(/<selection[\s\S]*?<\/selection>\s*/g, "")
        .replace(/<file[\s\S]*?<\/file>\s*/g, "")
        .trim();
      if (!text) continue;
      const first = text.split("\n")[0].trim();
      return first.length > 40 ? `${first.slice(0, 40)}…` : first;
    }
  }
  return "New chat";
}

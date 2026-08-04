import { LazyStore } from "@tauri-apps/plugin-store";
import type { VoicePromptResult } from "./voicePrompt";

export const VOICE_PROMPT_HISTORY_LIMIT = 5;

export type VoicePromptHistoryEntry = Pick<
  VoicePromptResult,
  "kind" | "text"
> & {
  createdAt: number;
};

const STORE_PATH = "cmdspace-voice-prompts.json";
const store = new LazyStore(STORE_PATH, { defaults: {}, autoSave: 200 });

const keyFor = (scope: string) => `recent:${encodeURIComponent(scope)}`;

function isHistoryEntry(value: unknown): value is VoicePromptHistoryEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "text" in value &&
    "createdAt" in value &&
    (value.kind === "ship" || value.kind === "scout") &&
    typeof value.text === "string" &&
    typeof value.createdAt === "number"
  );
}

export function prependVoicePromptHistory(
  entries: VoicePromptHistoryEntry[],
  next: VoicePromptHistoryEntry,
): VoicePromptHistoryEntry[] {
  return [next, ...entries.filter((entry) => entry.text !== next.text)].slice(
    0,
    VOICE_PROMPT_HISTORY_LIMIT,
  );
}

export async function loadVoicePromptHistory(
  scope: string,
): Promise<VoicePromptHistoryEntry[]> {
  const stored = await store.get<unknown>(keyFor(scope));
  if (!Array.isArray(stored)) return [];
  return stored.filter(isHistoryEntry).slice(0, VOICE_PROMPT_HISTORY_LIMIT);
}

export async function saveVoicePromptHistory(
  scope: string,
  draft: Pick<VoicePromptResult, "kind" | "text">,
): Promise<void> {
  const history = await loadVoicePromptHistory(scope);
  await store.set(
    keyFor(scope),
    prependVoicePromptHistory(history, { ...draft, createdAt: Date.now() }),
  );
}

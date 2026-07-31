import { describe, expect, it } from "vitest";
import {
  VOICE_PROMPT_HISTORY_LIMIT,
  prependVoicePromptHistory,
  type VoicePromptHistoryEntry,
} from "./voicePromptHistory";

const entry = (text: string): VoicePromptHistoryEntry => ({
  text,
  kind: "ship",
  createdAt: 1,
});

describe("voice prompt history", () => {
  it("keeps the five most recent unique drafts for the active terminal", () => {
    const history = ["one", "two", "three", "four", "five"].reduce(
      (current, text) => prependVoicePromptHistory(current, entry(text)),
      [] as VoicePromptHistoryEntry[],
    );

    expect(prependVoicePromptHistory(history, entry("six"))).toEqual([
      entry("six"),
      entry("five"),
      entry("four"),
      entry("three"),
      entry("two"),
    ]);
    expect(VOICE_PROMPT_HISTORY_LIMIT).toBe(5);
  });

  it("moves a repeated draft to the newest position instead of duplicating it", () => {
    const existing = [entry("newest"), entry("older")];

    expect(prependVoicePromptHistory(existing, entry("older"))).toEqual([
      entry("older"),
      entry("newest"),
    ]);
  });
});

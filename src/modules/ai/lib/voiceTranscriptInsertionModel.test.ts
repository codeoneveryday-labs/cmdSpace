import { describe, expect, it, vi } from "vitest";

import {
  NO_ACTIVE_VOICE_TARGET_MESSAGE,
  resolveVoiceTranscriptInsertion,
  type SpeechInputTarget,
} from "./voiceTranscriptInsertionModel";

const target: SpeechInputTarget = {
  kind: "terminal-pane",
  tabId: 7,
  terminalId: 3,
};

describe("resolveVoiceTranscriptInsertion", () => {
  it("reports an unavailable target without attempting insertion", () => {
    const insertTranscript = vi.fn();

    expect(
      resolveVoiceTranscriptInsertion(null, "open the terminal", insertTranscript),
    ).toEqual({
      kind: "error",
      message: "The target terminal is no longer available.",
    });
    expect(insertTranscript).not.toHaveBeenCalled();
  });

  it("reports a busy terminal when insertion is rejected", () => {
    expect(
      resolveVoiceTranscriptInsertion(target, "run tests", () => false),
    ).toEqual({
      kind: "error",
      message: "The terminal is busy. Wait for the command to finish, then try again.",
    });
  });

  it("preserves the target and transcript when insertion succeeds", () => {
    const insertTranscript = vi.fn(() => true);

    expect(
      resolveVoiceTranscriptInsertion(target, "mở package json", insertTranscript),
    ).toEqual({ kind: "ready", message: "Transcript inserted into terminal." });
    expect(insertTranscript).toHaveBeenCalledWith(target, "mở package json");
  });

  it("uses a thrown error message when insertion fails", () => {
    expect(
      resolveVoiceTranscriptInsertion(target, "run tests", () => {
        throw new Error("PTY is closed");
      }),
    ).toEqual({ kind: "error", message: "PTY is closed" });
  });

  it("exposes an actionable message for starting without an active terminal", () => {
    expect(NO_ACTIVE_VOICE_TARGET_MESSAGE).toContain("active terminal");
  });
});

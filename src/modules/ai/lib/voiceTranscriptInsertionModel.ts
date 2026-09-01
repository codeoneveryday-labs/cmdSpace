export type SpeechInputTarget =
  | {
      kind: "terminal-pane";
      tabId: number;
      terminalId: number;
    }
  | {
      kind: "canvas-terminal";
      tabId: number;
      terminalId: string;
    };

export type VoiceTranscriptInsertionOutcome =
  | { kind: "ready"; message: "Transcript inserted into terminal." }
  | { kind: "error"; message: string };

function messageFor(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Voice transcript insertion failed. Try again.";
}

export function resolveVoiceTranscriptInsertion(
  target: SpeechInputTarget | null,
  transcript: string,
  insertTranscript: (target: SpeechInputTarget, transcript: string) => boolean,
): VoiceTranscriptInsertionOutcome {
  if (!target) {
    return {
      kind: "error",
      message: "The target terminal is no longer available.",
    };
  }

  try {
    if (!insertTranscript(target, transcript)) {
      return {
        kind: "error",
        message: "The terminal is busy. Wait for the command to finish, then try again.",
      };
    }
  } catch (error) {
    return { kind: "error", message: messageFor(error) };
  }

  return { kind: "ready", message: "Transcript inserted into terminal." };
}

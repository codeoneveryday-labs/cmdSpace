export type RealtimeSpeechProviderId =
  | "openai"
  | "deepgram"
  | "assemblyai"
  | "speechmatics";

export type RealtimeSpeechEvent =
  | { kind: "partial"; text: string }
  | { kind: "final"; text: string };

export type RealtimeSpeechModel = {
  modelId: string;
  provider: RealtimeSpeechProviderId;
  label: string;
  description: string;
  transport: "websocket";
  audio: {
    encoding: "linear16";
    sampleRate: 16_000 | 24_000;
  };
};

/**
 * These are deliberately separate from file-transcription models. A realtime
 * selection needs a bidirectional session and PCM frames; it must never fall
 * through to the one-shot MediaRecorder upload path.
 */
export const REALTIME_SPEECH_MODELS: readonly RealtimeSpeechModel[] = [
  {
    modelId: "gpt-live-transcribe",
    provider: "openai",
    label: "GPT Live Transcribe",
    description: "OpenAI realtime transcription with partial results.",
    transport: "websocket",
    audio: { encoding: "linear16", sampleRate: 24_000 },
  },
  {
    modelId: "deepgram-nova-3-realtime",
    provider: "deepgram",
    label: "Nova-3 Realtime",
    description: "Deepgram live transcription with endpointed final results.",
    transport: "websocket",
    audio: { encoding: "linear16", sampleRate: 16_000 },
  },
  {
    modelId: "assemblyai-universal-streaming",
    provider: "assemblyai",
    label: "Universal Streaming",
    description: "AssemblyAI realtime transcription with turn detection.",
    transport: "websocket",
    audio: { encoding: "linear16", sampleRate: 16_000 },
  },
  {
    modelId: "speechmatics-realtime",
    provider: "speechmatics",
    label: "Realtime",
    description: "Speechmatics realtime transcription with partial results.",
    transport: "websocket",
    audio: { encoding: "linear16", sampleRate: 16_000 },
  },
] as const;

export function getRealtimeSpeechModel(
  modelId: string,
): RealtimeSpeechModel | null {
  return (
    REALTIME_SPEECH_MODELS.find((model) => model.modelId === modelId) ?? null
  );
}

export function parseRealtimeSpeechEvent(
  provider: RealtimeSpeechProviderId,
  payload: unknown,
): RealtimeSpeechEvent | null {
  if (!isRecord(payload)) return null;

  switch (provider) {
    case "openai":
      return parseOpenAiEvent(payload);
    case "deepgram":
      return parseDeepgramEvent(payload);
    case "assemblyai":
      return parseAssemblyAiEvent(payload);
    case "speechmatics":
      return parseSpeechmaticsEvent(payload);
  }
}

function parseOpenAiEvent(payload: Record<string, unknown>): RealtimeSpeechEvent | null {
  if (
    payload.type === "conversation.item.input_audio_transcription.delta" &&
    typeof payload.delta === "string"
  ) {
    return transcript("partial", payload.delta);
  }
  if (
    payload.type === "conversation.item.input_audio_transcription.completed" &&
    typeof payload.transcript === "string"
  ) {
    return transcript("final", payload.transcript);
  }
  return null;
}

function parseDeepgramEvent(payload: Record<string, unknown>): RealtimeSpeechEvent | null {
  if (payload.type !== "Results") return null;
  const text = nestedTranscript(payload.channel);
  if (!text) return null;
  return transcript(payload.speech_final === true ? "final" : "partial", text);
}

function parseAssemblyAiEvent(payload: Record<string, unknown>): RealtimeSpeechEvent | null {
  if (payload.type !== "Turn" || typeof payload.transcript !== "string") {
    return null;
  }
  return transcript(payload.end_of_turn === true ? "final" : "partial", payload.transcript);
}

function parseSpeechmaticsEvent(payload: Record<string, unknown>): RealtimeSpeechEvent | null {
  const text = nestedString(payload.metadata, "transcript");
  if (!text) return null;
  if (payload.message === "AddPartialTranscript") return transcript("partial", text);
  if (payload.message === "AddTranscript") return transcript("final", text);
  return null;
}

function nestedTranscript(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.alternatives)) return null;
  const first = value.alternatives[0];
  return isRecord(first) && typeof first.transcript === "string"
    ? first.transcript
    : null;
}

function nestedString(value: unknown, key: string): string | null {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : null;
}

function transcript(
  kind: RealtimeSpeechEvent["kind"],
  text: string,
): RealtimeSpeechEvent | null {
  return text.trim() ? { kind, text } : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

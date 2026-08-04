import type { ProviderId } from "../config";

type SpeechToTextProviderId = Extract<ProviderId, "openai" | "groq" | "nvidia">;

export type SpeechToTextModel = {
  modelId: string;
  provider: SpeechToTextProviderId;
  label: string;
  description: string;
  endpoint: string;
  sendModel?: boolean;
  language?: string;
  developmentOnly?: boolean;
};

export const SPEECH_TO_TEXT_MODELS: readonly SpeechToTextModel[] = [
  {
    modelId: "gpt-4o-transcribe",
    provider: "openai",
    label: "GPT-4o Transcribe",
    description: "Multilingual transcription from OpenAI.",
    endpoint: "https://api.openai.com/v1/audio/transcriptions",
  },
  {
    modelId: "whisper-large-v3-turbo",
    provider: "groq",
    label: "Whisper Large v3 Turbo",
    description: "Fast, low-cost multilingual transcription.",
    endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
  },
  {
    modelId: "nvidia/parakeet-ctc-1.1b-asr",
    provider: "nvidia",
    label: "Parakeet CTC 1.1B",
    description: "Free development API; English transcription.",
    endpoint:
      "https://1598d209-5e27-4d3c-8079-4751568b1081.invocation.api.nvcf.nvidia.com/v1/audio/transcriptions",
    sendModel: false,
    language: "en-US",
    developmentOnly: true,
  },
] as const;

export const DEFAULT_SPEECH_TO_TEXT_MODEL_ID = "gpt-4o-transcribe";

export type SpeechToTextRequest = SpeechToTextModel & { apiKey: string };

export function getSpeechToTextRequest(
  modelId: string,
  apiKeys: Partial<Record<ProviderId, string | null>>,
): SpeechToTextRequest | null {
  const model = SPEECH_TO_TEXT_MODELS.find(
    (candidate) => candidate.modelId === modelId,
  );
  const apiKey = model ? apiKeys[model.provider]?.trim() : null;
  return model && apiKey ? { ...model, apiKey } : null;
}

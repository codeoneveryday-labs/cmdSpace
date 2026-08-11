import { PROVIDERS, type ProviderId } from "../config";

export type SpeechToTextModel = {
  modelId: string;
  provider: ProviderId;
  label: string;
  description: string;
  endpoint: string;
  sendModel?: boolean;
  language?: string;
  developmentOnly?: boolean;
};

export const SPEECH_TO_TEXT_MODELS: readonly SpeechToTextModel[] = PROVIDERS.map(
  ({ id, speechToText }) => ({
    provider: id,
    ...speechToText,
  }),
);

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
  return model && apiKey && !model.developmentOnly
    ? { ...model, apiKey }
    : null;
}

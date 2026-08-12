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

const HEALTH_CHECK_SAMPLE_RATE = 8_000;
const HEALTH_CHECK_SAMPLE_DURATION_SECONDS = 0.25;

function healthCheckAudio(): File {
  const sampleCount = HEALTH_CHECK_SAMPLE_RATE * HEALTH_CHECK_SAMPLE_DURATION_SECONDS;
  const pcmLength = sampleCount * 2;
  const bytes = new Uint8Array(44 + pcmLength);
  const view = new DataView(bytes.buffer);
  const writeText = (offset: number, value: string) => {
    [...value].forEach((character, index) =>
      view.setUint8(offset + index, character.charCodeAt(0)),
    );
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + pcmLength, true);
  writeText(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, HEALTH_CHECK_SAMPLE_RATE, true);
  view.setUint32(28, HEALTH_CHECK_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, pcmLength, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const sample = Math.round(
      Math.sin((index * 2 * Math.PI * 440) / HEALTH_CHECK_SAMPLE_RATE) * 1_024,
    );
    view.setInt16(44 + index * 2, sample, true);
  }

  return new File([bytes], "cmdspace-stt-health-check.wav", {
    type: "audio/wav",
  });
}

/**
 * Verifies the same authenticated multipart endpoint used for a real Space
 * transcription without capturing microphone audio or retaining any content.
 */
export async function probeSpeechToText(
  request: SpeechToTextRequest,
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<void> {
  const formData = new FormData();
  formData.append("file", healthCheckAudio());
  if (request.sendModel !== false) formData.append("model", request.modelId);
  if (request.language) formData.append("language", request.language);

  const response = await fetcher(request.endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${request.apiKey}` },
    body: formData,
  });
  if (!response.ok) {
    throw new Error(
      `${request.provider === "openai" ? "OpenAI" : request.provider} transcription check failed (${response.status}).`,
    );
  }
}

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

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

export type SpeechToTextHttpRequest = {
  endpoint: string;
  headers: Record<string, string>;
  body: BodyInit;
  transcriptFromResponse: (payload: unknown) => string | null;
};

const HEALTH_CHECK_SAMPLE_RATE = 8_000;
const HEALTH_CHECK_SAMPLE_DURATION_SECONDS = 0.25;
const DEVELOPER_VOCABULARY_PROMPT =
  "Đây là câu đọc chính tả của lập trình viên, có thể xen tiếng Việt và English. Giữ nguyên chính tả của thuật ngữ kỹ thuật và tên riêng: cmdSpace, Codex, Claude, OpenAI, Tauri, Rust, Cargo, TypeScript, JavaScript, React, Vite, pnpm, Node.js, xterm.js, CodeMirror, Vitest, Git, GitHub, API, SDK, CLI, terminal, workspace, repository, Docker, Kubernetes, PostgreSQL, SQLite.";
const DEVELOPER_KEYTERMS = [
  "cmdSpace",
  "Codex",
  "Claude",
  "OpenAI",
  "Tauri",
  "Rust",
  "Cargo",
  "TypeScript",
  "JavaScript",
  "React",
  "Vite",
  "pnpm",
  "Node.js",
  "xterm.js",
  "CodeMirror",
  "Vitest",
  "Git",
  "GitHub",
  "API",
  "SDK",
  "CLI",
  "terminal",
  "workspace",
  "repository",
  "Docker",
  "Kubernetes",
  "PostgreSQL",
  "SQLite",
] as const;

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

/** Builds the multipart payload for OpenAI-compatible Space cloud transcription. */
export function createSpeechToTextFormData(
  recording: Blob,
  filename: string,
  request: SpeechToTextRequest,
  developerVocabulary = "",
): FormData {
  const formData = new FormData();
  formData.append("file", new File([recording], filename, { type: recording.type }));
  if (request.sendModel !== false) formData.append("model", request.modelId);
  if (request.language) formData.append("language", request.language);
  const workspaceVocabulary = developerVocabulary.trim();
  formData.append(
    "prompt",
    workspaceVocabulary
      ? `${DEVELOPER_VOCABULARY_PROMPT} Từ vựng workspace hiện tại: ${workspaceVocabulary}.`
      : DEVELOPER_VOCABULARY_PROMPT,
  );
  return formData;
}

function deepgramKeyterms(developerVocabulary: string): string[] {
  const workspaceTerms = developerVocabulary
    .split(/[\n,]/)
    .map((term) => term.trim())
    .filter(Boolean);
  return [...new Set([...DEVELOPER_KEYTERMS, ...workspaceTerms])].slice(0, 100);
}

function deepgramTranscript(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null || !("results" in payload)) {
    return null;
  }
  const results = payload.results;
  if (typeof results !== "object" || results === null || !("channels" in results)) {
    return null;
  }
  const [channel] = Array.isArray(results.channels) ? results.channels : [];
  if (typeof channel !== "object" || channel === null || !("alternatives" in channel)) {
    return null;
  }
  const [alternative] = Array.isArray(channel.alternatives) ? channel.alternatives : [];
  return typeof alternative === "object" && alternative !== null && "transcript" in alternative &&
    typeof alternative.transcript === "string"
    ? alternative.transcript
    : null;
}

function openAiCompatibleTranscript(payload: unknown): string | null {
  return typeof payload === "object" &&
    payload !== null &&
    "text" in payload &&
    typeof payload.text === "string"
    ? payload.text
    : null;
}

/** Builds the provider-specific authenticated payload used by live STT and health checks. */
export function createSpeechToTextHttpRequest(
  recording: Blob,
  filename: string,
  request: SpeechToTextRequest,
  developerVocabulary = "",
): SpeechToTextHttpRequest {
  if (request.provider === "deepgram") {
    const endpoint = new URL(request.endpoint);
    endpoint.searchParams.set("model", request.modelId);
    endpoint.searchParams.set("language", "multi");
    for (const term of deepgramKeyterms(developerVocabulary)) {
      endpoint.searchParams.append("keyterm", term);
    }
    return {
      endpoint: endpoint.toString(),
      headers: {
        Authorization: `Token ${request.apiKey}`,
        "Content-Type": recording.type || "audio/wav",
      },
      body: recording,
      transcriptFromResponse: deepgramTranscript,
    };
  }

  return {
    endpoint: request.endpoint,
    headers: { Authorization: `Bearer ${request.apiKey}` },
    body: createSpeechToTextFormData(recording, filename, request, developerVocabulary),
    transcriptFromResponse: openAiCompatibleTranscript,
  };
}

export async function transcribeSpeechToText(
  recording: Blob,
  filename: string,
  request: SpeechToTextRequest,
  developerVocabulary = "",
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<string> {
  const prepared = createSpeechToTextHttpRequest(
    recording,
    filename,
    request,
    developerVocabulary,
  );
  const response = await fetcher(prepared.endpoint, {
    method: "POST",
    headers: prepared.headers,
    body: prepared.body,
  });
  if (!response.ok) {
    throw new Error(`${request.provider} transcription failed (${response.status}).`);
  }
  const transcript = prepared.transcriptFromResponse(await response.json());
  if (transcript === null) {
    throw new Error(`${request.provider} transcription returned no text.`);
  }
  return transcript;
}

/**
 * Verifies the same authenticated endpoint used for a real Space transcription
 * without capturing microphone audio or retaining any content.
 */
export async function probeSpeechToText(
  request: SpeechToTextRequest,
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> = fetch,
  signal?: AbortSignal,
): Promise<void> {
  const prepared = createSpeechToTextHttpRequest(
    healthCheckAudio(),
    "cmdspace-stt-health-check.wav",
    request,
  );

  const response = await fetcher(prepared.endpoint, {
    method: "POST",
    headers: prepared.headers,
    body: prepared.body,
    ...(signal ? { signal } : {}),
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

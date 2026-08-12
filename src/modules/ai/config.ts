export const KEYRING_SERVICE = "cmdspace-ai";

export type ProviderId =
  | "openai"
  | "deepgram"
  | "google"
  | "assemblyai"
  | "speechmatics"
  | "elevenlabs"
  | "aws"
  | "azure"
  | "gladia"
  | "soniox"
  | "groq"
  | "inworld"
  | "rev"
  | "verbit"
  | "nuance"
  | "ibm"
  | "cloudflare"
  | "fireworks"
  | "together"
  | "replicate"
  | "nvidia";

export type SpeechToTextInfo = {
  modelId: string;
  label: string;
  description: string;
  endpoint: string;
  sendModel?: boolean;
  language?: string;
  developmentOnly?: boolean;
};

export type ProviderInfo = {
  id: ProviderId;
  label: string;
  keyringAccount: string;
  keyPrefix: string | null;
  consoleUrl: string;
  speechToText: SpeechToTextInfo;
};

export const PROVIDERS: readonly ProviderInfo[] = [
  {
    id: "openai",
    label: "OpenAI",
    keyringAccount: "openai-api-key",
    keyPrefix: "sk-",
    consoleUrl: "https://platform.openai.com/api-keys",
    speechToText: {
      modelId: "gpt-4o-transcribe",
      label: "GPT-4o Transcribe",
      description: "Multilingual transcription from OpenAI.",
      endpoint: "https://api.openai.com/v1/audio/transcriptions",
    },
  },
  {
    id: "deepgram",
    label: "Deepgram",
    keyringAccount: "deepgram-api-key",
    keyPrefix: null,
    consoleUrl: "https://console.deepgram.com/",
    speechToText: {
      modelId: "nova-3",
      label: "Nova-3",
      description: "Realtime and batch transcription from Deepgram.",
      endpoint: "https://api.deepgram.com/v1/listen",
    },
  },
  {
    id: "google",
    label: "Google Cloud",
    keyringAccount: "google-cloud-api-key",
    keyPrefix: null,
    consoleUrl: "https://console.cloud.google.com/apis/credentials",
    speechToText: {
      modelId: "chirp-3",
      label: "Chirp 3 / Speech-to-Text",
      description: "Cloud Speech-to-Text from Google.",
      endpoint: "https://speech.googleapis.com/v1/speech:recognize",
      developmentOnly: true,
    },
  },
  {
    id: "assemblyai",
    label: "AssemblyAI",
    keyringAccount: "assemblyai-api-key",
    keyPrefix: null,
    consoleUrl: "https://www.assemblyai.com/app",
    speechToText: {
      modelId: "universal",
      label: "Universal Streaming / Universal",
      description: "Streaming and batch transcription from AssemblyAI.",
      endpoint: "https://sync.assemblyai.com/transcribe",
      developmentOnly: true,
    },
  },
  {
    id: "speechmatics",
    label: "Speechmatics",
    keyringAccount: "speechmatics-api-key",
    keyPrefix: null,
    consoleUrl: "https://app.speechmatics.com/",
    speechToText: {
      modelId: "realtime",
      label: "Realtime / Batch STT",
      description: "Realtime and batch transcription from Speechmatics.",
      endpoint: "https://eu1.asr.api.speechmatics.com/v2/jobs/",
      developmentOnly: true,
    },
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    keyringAccount: "elevenlabs-api-key",
    keyPrefix: null,
    consoleUrl: "https://elevenlabs.io/app",
    speechToText: {
      modelId: "scribe_v2",
      label: "Scribe",
      description: "Transcription from ElevenLabs Scribe.",
      endpoint: "https://api.elevenlabs.io/v1/speech-to-text",
      developmentOnly: true,
    },
  },
  {
    id: "aws",
    label: "Amazon AWS",
    keyringAccount: "aws-transcribe-api-key",
    keyPrefix: null,
    consoleUrl: "https://console.aws.amazon.com/transcribe/home",
    speechToText: {
      modelId: "amazon-transcribe",
      label: "Amazon Transcribe",
      description: "Managed transcription from Amazon Transcribe.",
      endpoint: "https://transcribe.us-east-2.amazonaws.com",
      developmentOnly: true,
    },
  },
  {
    id: "azure",
    label: "Microsoft Azure",
    keyringAccount: "azure-speech-api-key",
    keyPrefix: null,
    consoleUrl: "https://portal.azure.com/",
    speechToText: {
      modelId: "azure-ai-speech",
      label: "Azure AI Speech",
      description: "Speech-to-text from Azure AI Speech.",
      endpoint:
        "https://eastus.api.cognitive.microsoft.com/speechtotext/v3.2/transcriptions",
      developmentOnly: true,
    },
  },
  {
    id: "gladia",
    label: "Gladia",
    keyringAccount: "gladia-api-key",
    keyPrefix: null,
    consoleUrl: "https://app.gladia.io/",
    speechToText: {
      modelId: "gladia-stt",
      label: "Gladia STT",
      description: "Hosted transcription from Gladia.",
      endpoint: "https://api.gladia.io/audio/text/audio-transcription",
      developmentOnly: true,
    },
  },
  {
    id: "soniox",
    label: "Soniox",
    keyringAccount: "soniox-api-key",
    keyPrefix: null,
    consoleUrl: "https://soniox.com/",
    speechToText: {
      modelId: "soniox-stt",
      label: "Soniox STT",
      description: "Hosted transcription from Soniox.",
      endpoint: "https://api.soniox.com/v1/transcriptions",
      developmentOnly: true,
    },
  },
  {
    id: "groq",
    label: "Groq",
    keyringAccount: "groq-api-key",
    keyPrefix: "gsk_",
    consoleUrl: "https://console.groq.com/keys",
    speechToText: {
      modelId: "whisper-large-v3-turbo",
      label: "Whisper hosted API",
      description: "OpenAI-compatible transcription on Groq.",
      endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
    },
  },
  {
    id: "inworld",
    label: "Inworld AI",
    keyringAccount: "inworld-api-key",
    keyPrefix: null,
    consoleUrl: "https://console.inworld.ai/",
    speechToText: {
      modelId: "realtime-stt",
      label: "Realtime STT",
      description: "Realtime transcription from Inworld AI.",
      endpoint: "https://api.inworld.ai/stt/v1/transcribe",
      developmentOnly: true,
    },
  },
  {
    id: "rev",
    label: "Rev AI",
    keyringAccount: "rev-ai-api-key",
    keyPrefix: null,
    consoleUrl: "https://www.rev.ai/app",
    speechToText: {
      modelId: "streaming",
      label: "Streaming / Async STT",
      description: "Streaming and async transcription from Rev AI.",
      endpoint: "https://api.rev.ai/speechtotext/v1/jobs",
      developmentOnly: true,
    },
  },
  {
    id: "verbit",
    label: "Verbit",
    keyringAccount: "verbit-api-key",
    keyPrefix: null,
    consoleUrl: "https://app.verbit.ai/",
    speechToText: {
      modelId: "speech-recognition",
      label: "Speech Recognition API",
      description: "Live and post-production transcription from Verbit.",
      endpoint: "https://api.verbit.co/api/",
      developmentOnly: true,
    },
  },
  {
    id: "nuance",
    label: "Nuance",
    keyringAccount: "nuance-api-key",
    keyPrefix: null,
    consoleUrl: "https://mix.nuance.com/",
    speechToText: {
      modelId: "dragon",
      label: "Dragon / Speech Recognition",
      description: "Nuance Mix ASRaaS speech recognition.",
      endpoint: "https://asr.api.nuance.com:443",
      developmentOnly: true,
    },
  },
  {
    id: "ibm",
    label: "IBM Cloud",
    keyringAccount: "ibm-cloud-api-key",
    keyPrefix: null,
    consoleUrl: "https://cloud.ibm.com/apikeys",
    speechToText: {
      modelId: "watson-speech-to-text",
      label: "Watson Speech to Text",
      description: "Watson speech-to-text from IBM Cloud.",
      endpoint: "https://api.us-south.speech-to-text.watson.cloud.ibm.com/v1/recognize",
      developmentOnly: true,
    },
  },
  {
    id: "cloudflare",
    label: "Cloudflare Workers AI",
    keyringAccount: "cloudflare-workers-ai-api-key",
    keyPrefix: null,
    consoleUrl: "https://dash.cloudflare.com/",
    speechToText: {
      modelId: "workers-ai-whisper",
      label: "Hosted Whisper/STT",
      description: "Hosted Whisper transcription on Workers AI.",
      endpoint:
        "https://api.cloudflare.com/client/v4/accounts/<account_id>/ai/run/@cf/openai/whisper-large-v3",
      developmentOnly: true,
    },
  },
  {
    id: "fireworks",
    label: "Fireworks AI",
    keyringAccount: "fireworks-api-key",
    keyPrefix: null,
    consoleUrl: "https://app.fireworks.ai/",
    speechToText: {
      modelId: "hosted-speech-models",
      label: "Hosted speech models",
      description: "Hosted speech models on Fireworks AI.",
      endpoint: "https://api.fireworks.ai/inference/v1/audio/transcriptions",
      developmentOnly: true,
    },
  },
  {
    id: "together",
    label: "Together AI",
    keyringAccount: "together-api-key",
    keyPrefix: null,
    consoleUrl: "https://api.together.ai/settings/api-keys",
    speechToText: {
      modelId: "openai/whisper-large-v3",
      label: "Hosted speech models",
      description: "Hosted speech models on Together AI.",
      endpoint: "https://api.together.ai/v1/audio/transcriptions",
      developmentOnly: true,
    },
  },
  {
    id: "replicate",
    label: "Replicate",
    keyringAccount: "replicate-api-token",
    keyPrefix: null,
    consoleUrl: "https://replicate.com/account/api-tokens",
    speechToText: {
      modelId: "openai/whisper",
      label: "Hosted Whisper/STT models",
      description: "Hosted Whisper and ASR models on Replicate.",
      endpoint: "https://api.replicate.com/v1/predictions",
      developmentOnly: true,
    },
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    keyringAccount: "nvidia-api-key",
    keyPrefix: "nvapi-",
    consoleUrl: "https://build.nvidia.com/settings/api-keys",
    speechToText: {
      modelId: "nvidia/parakeet-ctc-1.1b-asr",
      label: "Parakeet CTC 1.1B",
      description: "Free development API; English transcription.",
      endpoint:
        "https://1598d209-5e27-4d3c-8079-4751568b1081.invocation.api.nvcf.nvidia.com/v1/audio/transcriptions",
      sendModel: false,
      language: "en-US",
      developmentOnly: true,
    },
  },
] as const;

/** Keep the existing cloud choices visible after migrating to the catalog UI. */
export const DEFAULT_CONFIGURED_SPEECH_TO_TEXT_PROVIDER_IDS: ProviderId[] = [
  "openai",
  "groq",
  "nvidia",
];

export function normalizeSpeechToTextProviderIds(
  providerIds: readonly string[],
): ProviderId[] {
  const known = new Set(PROVIDERS.map((provider) => provider.id));
  return [...new Set(providerIds)].filter(
    (providerId): providerId is ProviderId => known.has(providerId as ProviderId),
  );
}

export function getProvider(id: ProviderId): ProviderInfo {
  const provider = PROVIDERS.find((item) => item.id === id);
  if (!provider) throw new Error(`Unknown provider: ${id}`);
  return provider;
}

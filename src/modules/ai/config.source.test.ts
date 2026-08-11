import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../..",
);
const configPath = path.join(root, "src/modules/ai/config.ts");
const keyringPath = path.join(root, "src/modules/ai/lib/keyring.ts");
const secretsPath = path.join(root, "src-tauri/src/modules/secrets.rs");
const settingsIconPath = path.join(
  root,
  "src/settings/components/ProviderIcon.tsx",
);

describe("AI provider catalog", () => {
  it("expands the STT provider catalog with the staged cloud providers", () => {
    const config = readFileSync(configPath, "utf8");
    const keyring = readFileSync(keyringPath, "utf8");
    const secrets = readFileSync(secretsPath, "utf8");
    const settingsIcon = readFileSync(settingsIconPath, "utf8");

    expect(config).toContain('export type ProviderId =');
    for (const id of [
      "openai",
      "deepgram",
      "google",
      "assemblyai",
      "speechmatics",
      "elevenlabs",
      "aws",
      "azure",
      "gladia",
      "soniox",
      "groq",
      "inworld",
      "rev",
      "verbit",
      "nuance",
      "ibm",
      "cloudflare",
      "fireworks",
      "together",
      "replicate",
      "nvidia",
    ]) {
      expect(config).toContain(`id: "${id}"`);
    }
    expect(config).not.toContain('id: "anthropic"');
    expect(config).not.toContain('id: "zenmux"');

    expect(keyring).toContain("Object.fromEntries");
    expect(keyring).toContain("PROVIDERS.map");
    expect(keyring).not.toContain("anthropic: null");

    expect(settingsIcon).toContain("openai: ChatGptIcon");
    expect(settingsIcon).toContain("deepgram: AudioWaveIcon");
    expect(settingsIcon).toContain("google: GoogleIcon");
    expect(settingsIcon).toContain("assemblyai: AiAudioIcon");
    expect(settingsIcon).toContain("speechmatics: SpeechIcon");
    expect(settingsIcon).toContain("elevenlabs: VoiceIcon");
    expect(settingsIcon).toContain("aws: AmazonIcon");
    expect(settingsIcon).toContain("azure: MicrosoftIcon");
    expect(settingsIcon).toContain("gladia: CloudIcon");
    expect(settingsIcon).toContain("soniox: MicIcon");
    expect(settingsIcon).toContain("groq: FlashIcon");
    expect(settingsIcon).toContain("inworld: RobotIcon");
    expect(settingsIcon).toContain("rev: FileAudioIcon");
    expect(settingsIcon).toContain("verbit: SpeechIcon");
    expect(settingsIcon).toContain("nuance: AiVoiceIcon");
    expect(settingsIcon).toContain("ibm: DatabaseIcon");
    expect(settingsIcon).toContain("cloudflare: CloudServerIcon");
    expect(settingsIcon).toContain("fireworks: AiCloudIcon");
    expect(settingsIcon).toContain("together: GlobeIcon");
    expect(settingsIcon).toContain("replicate: DatabaseIcon");
    expect(settingsIcon).toContain("nvidia: CpuIcon");
    expect(secrets).toContain("cache: Mutex<Option<HashMap<String, String>>>");
    expect(secrets).toContain(".get_or_insert_with(HashMap::new)");
    expect(secrets).toContain("cache.get(&cache_key).cloned()");
  });

  it("keeps the STT provider key metadata intact", () => {
    const config = readFileSync(configPath, "utf8");
    const keyring = readFileSync(keyringPath, "utf8");
    const settingsIcon = readFileSync(settingsIconPath, "utf8");

    expect(config).toContain('keyringAccount: "openai-api-key"');
    expect(config).toContain('keyringAccount: "deepgram-api-key"');
    expect(config).toContain('keyringAccount: "google-cloud-api-key"');
    expect(config).toContain('keyringAccount: "assemblyai-api-key"');
    expect(config).toContain('keyringAccount: "speechmatics-api-key"');
    expect(config).toContain('keyringAccount: "elevenlabs-api-key"');
    expect(config).toContain('keyringAccount: "aws-transcribe-api-key"');
    expect(config).toContain('keyringAccount: "azure-speech-api-key"');
    expect(config).toContain('keyringAccount: "gladia-api-key"');
    expect(config).toContain('keyringAccount: "soniox-api-key"');
    expect(config).toContain('keyringAccount: "groq-api-key"');
    expect(config).toContain('keyringAccount: "inworld-api-key"');
    expect(config).toContain('keyringAccount: "rev-ai-api-key"');
    expect(config).toContain('keyringAccount: "verbit-api-key"');
    expect(config).toContain('keyringAccount: "nuance-api-key"');
    expect(config).toContain('keyringAccount: "ibm-cloud-api-key"');
    expect(config).toContain('keyringAccount: "cloudflare-workers-ai-api-key"');
    expect(config).toContain('keyringAccount: "fireworks-api-key"');
    expect(config).toContain('keyringAccount: "together-api-key"');
    expect(config).toContain('keyringAccount: "replicate-api-token"');
    expect(config).toContain('keyringAccount: "nvidia-api-key"');
    expect(config).toContain('keyPrefix: "sk-"');
    expect(config).toContain('keyPrefix: "gsk_"');
    expect(config).toContain('keyPrefix: "nvapi-"');

    expect(keyring).toContain("Object.fromEntries");
    expect(keyring).toContain("PROVIDERS.map");
    expect(keyring).not.toContain("openrouter");
    expect(settingsIcon).toContain("nvidia: CpuIcon");
  });

  it("does not model unsupported keyless-provider behavior", () => {
    const config = readFileSync(configPath, "utf8");
    const keyring = readFileSync(keyringPath, "utf8");

    expect(config).not.toContain("providerSupportsKey");
    expect(keyring).not.toContain("providerSupportsKey");
    expect(keyring).toContain("const need = PROVIDERS;");
  });
});

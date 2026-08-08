import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "../../..",
);
const configPath = path.join(root, "src/modules/ai/config.ts");
const keyringPath = path.join(root, "src/modules/ai/lib/keyring.ts");
const agentPath = path.join(root, "src/modules/ai/lib/agent.ts");
const secretsPath = path.join(root, "src-tauri/src/modules/secrets.rs");
const settingsIconPath = path.join(
  root,
  "src/settings/components/ProviderIcon.tsx",
);
const statusControlsPath = path.join(
  root,
  "src/modules/ai/components/AiStatusBarControls.tsx",
);

describe("AI provider catalog", () => {
  it("registers ZenMux as an Anthropic-compatible provider end to end", () => {
    const config = readFileSync(configPath, "utf8");
    const keyring = readFileSync(keyringPath, "utf8");
    const agent = readFileSync(agentPath, "utf8");
    const secrets = readFileSync(secretsPath, "utf8");
    const settingsIcon = readFileSync(settingsIconPath, "utf8");
    const statusControls = readFileSync(statusControlsPath, "utf8");

    expect(config).toContain('| "zenmux"');
    expect(config).toContain('id: "zenmux"');
    expect(config).toContain('label: "ZenMux"');
    expect(config).toContain('keyringAccount: "zenmux-api-key"');
    expect(config).toContain('consoleUrl: "https://zenmux.ai/"');
    expect(config).toContain('id: "z-ai/glm-5.2"');
    expect(config).toContain('provider: "zenmux"');
    expect(config).toContain('label: "GLM 5.2"');
    expect(config).toContain('"z-ai/glm-5.2": 128_000');
    expect(config).toContain('zenmux: "z-ai/glm-5.2"');

    expect(keyring).toContain("zenmux: null");

    expect(agent).toContain('case "zenmux"');
    expect(agent).toContain('baseURL: "https://zenmux.ai/api/anthropic/v1"');
    expect(agent).toContain('name: "zenmux"');
    expect(agent).toContain("createAnthropic");

    expect(settingsIcon).toContain("zenmux: GlobeIcon");
    expect(statusControls).toContain("ProviderIcon");
    expect(statusControls).toContain("provider={p.id}");
    expect(secrets).toContain("cache: Mutex<Option<HashMap<String, String>>>");
    expect(secrets).toContain(".get_or_insert_with(HashMap::new)");
    expect(secrets).toContain("cache.get(&cache_key).cloned()");
  });

  it("registers NVIDIA NIM as an OpenAI-compatible provider end to end", () => {
    const config = readFileSync(configPath, "utf8");
    const keyring = readFileSync(keyringPath, "utf8");
    const agent = readFileSync(agentPath, "utf8");
    const settingsIcon = readFileSync(settingsIconPath, "utf8");
    const statusControls = readFileSync(statusControlsPath, "utf8");

    expect(config).toContain('| "nvidia"');
    expect(config).toContain('id: "nvidia"');
    expect(config).toContain('label: "NVIDIA NIM"');
    expect(config).toContain('keyringAccount: "nvidia-api-key"');
    expect(config).toContain(
      'consoleUrl: "https://build.nvidia.com/settings/api-keys"',
    );
    expect(config).toContain(
      'id: "nvidia/llama-3.3-nemotron-super-49b-v1.5"',
    );
    expect(config).toContain('provider: "nvidia"');
    expect(config).toContain('id: "meta/llama-3.3-70b-instruct"');
    expect(config).toContain('nvidia: "meta/llama-3.3-70b-instruct"');

    expect(keyring).toContain("nvidia: null");
    expect(agent).toContain('case "nvidia"');
    expect(agent).toContain(
      'baseURL: "https://integrate.api.nvidia.com/v1"',
    );
    expect(agent).toContain('name: "nvidia"');
    expect(agent).toContain("createOpenAICompatible");
    expect(agent).toContain('fetch: localProxyFetch');
    expect(settingsIcon).toContain("nvidia: CpuIcon");
    expect(statusControls).toContain("ProviderIcon");
  });
});

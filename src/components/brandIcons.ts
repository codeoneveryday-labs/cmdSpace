import claudeIconSvg from "@/assets/provider-icons/claude.svg?raw";
import codexIconSvg from "@/assets/provider-icons/codex.svg?raw";
import geminiIconSvg from "@/assets/provider-icons/gemini.svg?raw";
import opencodeIconSvg from "@/assets/provider-icons/opencode.svg?raw";
import copilotIconSvg from "@/assets/provider-icons/copilot.svg?raw";
import cursorIconSvg from "@/assets/provider-icons/cursor.svg?raw";
import piIconSvg from "@/assets/provider-icons/pi.svg?raw";
import ampIconSvg from "@/assets/provider-icons/amp.svg?raw";
import clineIconSvg from "@/assets/provider-icons/cline.svg?raw";
import gooseIconSvg from "@/assets/provider-icons/goose.svg?raw";
import qwenIconSvg from "@/assets/provider-icons/qwen.svg?raw";
import kimiIconSvg from "@/assets/provider-icons/kimi.svg?raw";
import grokIconSvg from "@/assets/provider-icons/grok.svg?raw";
import herdrIconSvg from "@/assets/provider-icons/herdr.svg?raw";
import mistralIconSvg from "@/assets/provider-icons/mistral.svg?raw";
import commandCodeIconSvg from "@/assets/provider-icons/cmd.svg?raw";
import auggieIconSvg from "@/assets/provider-icons/auggie.svg?raw";
import codebuddyIconSvg from "@/assets/provider-icons/codebuddy.svg?raw";
import cortexIconSvg from "@/assets/provider-icons/cortex.svg?raw";
import deepagentsIconSvg from "@/assets/provider-icons/deepagents.svg?raw";
import glmIconSvg from "@/assets/provider-icons/glm.svg?raw";
import junieIconSvg from "@/assets/provider-icons/junie.svg?raw";
import mistralVibeIconSvg from "@/assets/provider-icons/mistral-vibe.svg?raw";
import openhandsIconSvg from "@/assets/provider-icons/openhands-mark.svg?raw";
import kiroIconSvg from "@/assets/provider-icons/kiro.svg?raw";
import museIconSvg from "@/assets/provider-icons/muse.svg?raw";
import hermesIconUrl from "@/assets/provider-icons/hermes.png?url";
import devinIconUrl from "@/assets/provider-icons/devin.ico?url";
import deepgramIconSvg from "@/assets/provider-icons/deepgram.svg?raw";
import googleCloudIconSvg from "@/assets/provider-icons/googlecloud.svg?raw";
import elevenLabsIconSvg from "@/assets/provider-icons/elevenlabs.svg?raw";
import cloudflareIconSvg from "@/assets/provider-icons/cloudflare.svg?raw";
import replicateIconSvg from "@/assets/provider-icons/replicate.svg?raw";
import nvidiaIconSvg from "@/assets/provider-icons/nvidia.svg?raw";
import ompIconSvg from "@/assets/provider-icons/omp.svg?raw";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";
import type { ProviderId } from "@/modules/ai/config";

export const BRAND_ICON_ASSETS = {
  claude: claudeIconSvg,
  codex: codexIconSvg,
  gemini: geminiIconSvg,
  opencode: opencodeIconSvg,
  copilot: copilotIconSvg,
  cursor: cursorIconSvg,
  pi: piIconSvg,
  amp: ampIconSvg,
  cline: clineIconSvg,
  goose: gooseIconSvg,
  qwen: qwenIconSvg,
  kimi: kimiIconSvg,
  grok: grokIconSvg,
  herdr: herdrIconSvg,
  mistral: mistralIconSvg,
  cmd: commandCodeIconSvg,
  auggie: auggieIconSvg,
  codebuddy: codebuddyIconSvg,
  cortex: cortexIconSvg,
  deepagents: deepagentsIconSvg,
  glm: glmIconSvg,
  junie: junieIconSvg,
  "mistral-vibe": mistralVibeIconSvg,
  openhands: openhandsIconSvg,
  kiro: kiroIconSvg,
  muse: museIconSvg,
  deepgram: deepgramIconSvg,
  googlecloud: googleCloudIconSvg,
  elevenlabs: elevenLabsIconSvg,
  cloudflare: cloudflareIconSvg,
  replicate: replicateIconSvg,
  nvidia: nvidiaIconSvg,
  omp: ompIconSvg,
} as const;

export const BRAND_ICON_IMAGE_ASSETS = {
  devin: devinIconUrl,
  hermes: hermesIconUrl,
} as const;

export type BrandIconName =
  | keyof typeof BRAND_ICON_ASSETS
  | keyof typeof BRAND_ICON_IMAGE_ASSETS;

export const BRAND_ICON_SOURCE_URLS: Partial<
  Record<BrandIconName, string>
> = {
  omp: "https://raw.githubusercontent.com/unsigned-gg/omp/main/assets/icon.svg",
  cmd: "https://raw.githubusercontent.com/CommandCodeAI/command-code/main/.github/commandcode/symbols/commandcode.svg",
  herdr:
    "https://raw.githubusercontent.com/ogulcancelik/herdr/master/website/assets/agent-icons/herdr-mask.svg",
  muse: "https://raw.githubusercontent.com/gilbarbara/logos/main/logos/meta-icon.svg",
};

const PROVIDER_BRAND_ICONS: Partial<Record<ProviderId, BrandIconName>> = {
  openai: "codex",
  deepgram: "deepgram",
  google: "googlecloud",
  elevenlabs: "elevenlabs",
  groq: "grok",
  cloudflare: "cloudflare",
  replicate: "replicate",
  nvidia: "nvidia",
};

const AGENT_BRAND_ICONS: Partial<Record<CliAgent, BrandIconName>> = {
  omp: "omp",
  claude: "claude",
  codex: "codex",
  gemini: "gemini",
  opencode: "opencode",
  copilot: "copilot",
  cursor: "cursor",
  pi: "pi",
  amp: "amp",
  cline: "cline",
  goose: "goose",
  qwen: "qwen",
  kimi: "kimi",
  grok: "grok",
  herdr: "herdr",
  cmd: "cmd",
  auggie: "auggie",
  codebuddy: "codebuddy",
  cortex: "cortex",
  deepagents: "deepagents",
  glm: "glm",
  junie: "junie",
  "mistral-vibe": "mistral-vibe",
  openhands: "openhands",
  hermes: "hermes",
  kiro: "kiro",
  muse: "muse",
  devin: "devin",
};

export function getProviderBrandIcon(provider: ProviderId): BrandIconName | null {
  return PROVIDER_BRAND_ICONS[provider] ?? null;
}

export function getAgentBrandIcon(agent: CliAgent): BrandIconName | null {
  return AGENT_BRAND_ICONS[agent] ?? null;
}

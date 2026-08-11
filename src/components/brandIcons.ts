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
import deepgramIconSvg from "@/assets/provider-icons/deepgram.svg?raw";
import googleCloudIconSvg from "@/assets/provider-icons/googlecloud.svg?raw";
import elevenLabsIconSvg from "@/assets/provider-icons/elevenlabs.svg?raw";
import cloudflareIconSvg from "@/assets/provider-icons/cloudflare.svg?raw";
import replicateIconSvg from "@/assets/provider-icons/replicate.svg?raw";
import nvidiaIconSvg from "@/assets/provider-icons/nvidia.svg?raw";
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
  deepgram: deepgramIconSvg,
  googlecloud: googleCloudIconSvg,
  elevenlabs: elevenLabsIconSvg,
  cloudflare: cloudflareIconSvg,
  replicate: replicateIconSvg,
  nvidia: nvidiaIconSvg,
} as const;

export type BrandIconName = keyof typeof BRAND_ICON_ASSETS;

export const BRAND_ICON_SOURCE_URLS: Partial<
  Record<BrandIconName, string>
> = {
  cmd: "https://raw.githubusercontent.com/CommandCodeAI/command-code/main/.github/commandcode/symbols/commandcode.svg",
  herdr:
    "https://raw.githubusercontent.com/ogulcancelik/herdr/master/website/assets/agent-icons/herdr-mask.svg",
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
};

export function getProviderBrandIcon(provider: ProviderId): BrandIconName | null {
  return PROVIDER_BRAND_ICONS[provider] ?? null;
}

export function getAgentBrandIcon(agent: CliAgent): BrandIconName | null {
  return AGENT_BRAND_ICONS[agent] ?? null;
}

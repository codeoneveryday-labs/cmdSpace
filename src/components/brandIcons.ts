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
import mistralIconSvg from "@/assets/provider-icons/mistral.svg?raw";
import commandCodeIconSvg from "@/assets/provider-icons/cmd.svg?raw";
import type { ProviderId } from "@/modules/ai/config";
import type { CliAgent } from "@/modules/terminal/lib/cliAgents";

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
  mistral: mistralIconSvg,
  cmd: commandCodeIconSvg,
} as const;

export type BrandIconName = keyof typeof BRAND_ICON_ASSETS;

export const BRAND_ICON_SOURCE_URLS: Partial<
  Record<BrandIconName, string>
> = {
  cmd: "https://raw.githubusercontent.com/CommandCodeAI/command-code/main/.github/commandcode/symbols/commandcode.svg",
};

const PROVIDER_BRAND_ICONS: Partial<Record<ProviderId, BrandIconName>> = {
  openai: "codex",
  anthropic: "claude",
  google: "gemini",
  xai: "grok",
  mistral: "mistral",
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
  cmd: "cmd",
};

export function getProviderBrandIcon(provider: ProviderId): BrandIconName | null {
  return PROVIDER_BRAND_ICONS[provider] ?? null;
}

export function getAgentBrandIcon(agent: CliAgent): BrandIconName | null {
  return AGENT_BRAND_ICONS[agent] ?? null;
}

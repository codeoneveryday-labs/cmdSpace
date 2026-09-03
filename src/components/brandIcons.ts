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
import agoragenticIconSvg from "@/assets/provider-icons/agoragentic.svg?raw";
import auggieIconSvg from "@/assets/provider-icons/auggie.svg?raw";
import autohandIconSvg from "@/assets/provider-icons/autohand.svg?raw";
import codebuddyIconSvg from "@/assets/provider-icons/codebuddy.svg?raw";
import codewhaleIconSvg from "@/assets/provider-icons/codewhale.svg?raw";
import cortexIconSvg from "@/assets/provider-icons/cortex.svg?raw";
import corustIconSvg from "@/assets/provider-icons/corust.svg?raw";
import crowIconSvg from "@/assets/provider-icons/crow.svg?raw";
import deepagentsIconSvg from "@/assets/provider-icons/deepagents.svg?raw";
import dimcodeIconSvg from "@/assets/provider-icons/dimcode.svg?raw";
import diracIconSvg from "@/assets/provider-icons/dirac.svg?raw";
import factoryDroidIconSvg from "@/assets/provider-icons/factory-droid.svg?raw";
import fastAgentIconSvg from "@/assets/provider-icons/fast-agent.svg?raw";
import glmIconSvg from "@/assets/provider-icons/glm.svg?raw";
import junieIconSvg from "@/assets/provider-icons/junie.svg?raw";
import kiloIconSvg from "@/assets/provider-icons/kilo.svg?raw";
import minionIconSvg from "@/assets/provider-icons/minion.svg?raw";
import mistralVibeIconSvg from "@/assets/provider-icons/mistral-vibe.svg?raw";
import novaIconSvg from "@/assets/provider-icons/nova.svg?raw";
import poolsideIconSvg from "@/assets/provider-icons/poolside.svg?raw";
import qoderIconSvg from "@/assets/provider-icons/qoder.svg?raw";
import sigitIconSvg from "@/assets/provider-icons/sigit.svg?raw";
import stakpakIconSvg from "@/assets/provider-icons/stakpak.svg?raw";
import traeIconSvg from "@/assets/provider-icons/trae.svg?raw";
import vtCodeIconSvg from "@/assets/provider-icons/vt-code.svg?raw";
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
  agoragentic: agoragenticIconSvg,
  auggie: auggieIconSvg,
  autohand: autohandIconSvg,
  codebuddy: codebuddyIconSvg,
  codewhale: codewhaleIconSvg,
  cortex: cortexIconSvg,
  corust: corustIconSvg,
  crow: crowIconSvg,
  deepagents: deepagentsIconSvg,
  dimcode: dimcodeIconSvg,
  dirac: diracIconSvg,
  "factory-droid": factoryDroidIconSvg,
  "fast-agent": fastAgentIconSvg,
  glm: glmIconSvg,
  junie: junieIconSvg,
  kilo: kiloIconSvg,
  minion: minionIconSvg,
  "mistral-vibe": mistralVibeIconSvg,
  nova: novaIconSvg,
  poolside: poolsideIconSvg,
  qoder: qoderIconSvg,
  sigit: sigitIconSvg,
  stakpak: stakpakIconSvg,
  trae: traeIconSvg,
  "vt-code": vtCodeIconSvg,
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
  agoragentic: "agoragentic",
  auggie: "auggie",
  autohand: "autohand",
  codebuddy: "codebuddy",
  codewhale: "codewhale",
  cortex: "cortex",
  corust: "corust",
  crow: "crow",
  deepagents: "deepagents",
  dimcode: "dimcode",
  dirac: "dirac",
  "factory-droid": "factory-droid",
  "fast-agent": "fast-agent",
  glm: "glm",
  junie: "junie",
  kilo: "kilo",
  minion: "minion",
  "mistral-vibe": "mistral-vibe",
  nova: "nova",
  poolside: "poolside",
  qoder: "qoder",
  sigit: "sigit",
  stakpak: "stakpak",
  trae: "trae",
  "vt-code": "vt-code",
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

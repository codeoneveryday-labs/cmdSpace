import {
  matchCliAgentBannerPattern,
  matchCliAgentByExecutable,
} from "./cliAgentDetectionModel";

export const CLI_AGENT_IDS = [
  "claude",
  "codex",
  "gemini",
  "opencode",
  "copilot",
  "cursor",
  "aider",
  "pi",
  "omp",
  "amp",
  "cline",
  "goose",
  "qwen",
  "kimi",
  "openhands",
  "kiro",
  "grok",
  "herdr",
  "cmd",
  "agoragentic",
  "auggie",
  "autohand",
  "codebuddy",
  "codewhale",
  "cortex",
  "corust",
  "crow",
  "deepagents",
  "devin",
  "dimcode",
  "dirac",
  "factory-droid",
  "fast-agent",
  "glm",
  "hermes",
  "junie",
  "kilo",
  "minion",
  "mistral-vibe",
  "nova",
  "poolside",
  "qoder",
  "sigit",
  "stakpak",
  "trae",
  "vt-code",
] as const;

export type CliAgent = (typeof CLI_AGENT_IDS)[number];

export type CliAgentLaunchPolicy = "standard" | "unattended";
export type CliAgentChatTransport =
  | "codex-app-server"
  | "claude-json"
  | "omp-rpc"
  | "command-code-json";

export type CliAgentDefinition = {
  id: CliAgent;
  name: string;
  executable: string;
  command: string;
  launch: string;
  launchPolicy: CliAgentLaunchPolicy;
  chatTransport?: CliAgentChatTransport;
  bannerPatterns: RegExp[];
};

export type CliAgentCatalogEntry = CliAgentDefinition & {
  description: string;
  installUrl?: string;
};

export const DEFAULT_CONFIGURED_CLI_AGENT_IDS: CliAgent[] = [
  "claude",
  "codex",
  "gemini",
  "copilot",
  "opencode",
  "pi",
];

const CLI_AGENT_CATALOG_META: Record<
  CliAgent,
  { description: string; installUrl?: string }
> = {
  claude: {
    description: "Anthropic's agentic coding CLI for terminal workflows.",
    installUrl: "https://docs.anthropic.com/en/docs/claude-code/setup",
  },
  codex: {
    description: "OpenAI's coding agent for local terminal development.",
    installUrl: "https://developers.openai.com/codex/cli",
  },
  gemini: {
    description: "Google's official open-source Gemini coding CLI.",
    installUrl: "https://geminicli.com",
  },
  opencode: {
    description: "Open-source coding agent built for the terminal.",
    installUrl: "https://opencode.ai/docs",
  },
  copilot: {
    description: "GitHub Copilot's agentic command-line interface.",
    installUrl: "https://docs.github.com/en/copilot/how-tos/set-up/install-copilot-cli",
  },
  cursor: {
    description: "Cursor's coding agent for terminal and automation workflows.",
    installUrl: "https://docs.cursor.com/en/cli/overview",
  },
  aider: {
    description: "AI pair programming in your terminal with repository context.",
    installUrl: "https://aider.chat/docs/install.html",
  },
  pi: {
    description: "Minimal, extensible terminal coding agent from the Pi project.",
    installUrl: "https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent",
  },
  omp: {
    description: "Open, provider-rich coding agent with IDE-aware workflows.",
    installUrl: "https://omp.sh/",
  },
  amp: {
    description: "Sourcegraph's frontier coding agent for terminal development.",
    installUrl: "https://ampcode.com/manual",
  },
  cline: {
    description: "Autonomous coding agent CLI with file, shell, and browser tools.",
    installUrl: "https://cline.bot/cli",
  },
  goose: {
    description: "Local, extensible open-source agent for engineering tasks.",
    installUrl: "https://block.github.io/goose/docs/getting-started/installation/",
  },
  qwen: {
    description: "Alibaba's open-source Qwen coding assistant.",
    installUrl: "https://qwenlm.github.io/qwen-code-docs/en/users/overview",
  },
  kimi: {
    description: "Moonshot AI's open-source terminal coding agent.",
    installUrl: "https://github.com/MoonshotAI/kimi-code",
  },
  openhands: {
    description: "Open-source software development agent for local workflows.",
    installUrl: "https://docs.openhands.dev/openhands/usage/run-openhands/local-setup",
  },
  kiro: {
    description: "Kiro's terminal coding agent with spec-driven workflows.",
    installUrl: "https://kiro.dev/cli/",
  },
  grok: {
    description: "xAI's Grok coding agent for terminal development.",
    installUrl: "https://grok.com",
  },
  herdr: {
    description: "Persistent terminal workspace for running coding agents.",
    installUrl: "https://herdr.dev/docs/install/",
  },
  cmd: {
    description: "Command Code agent running directly in the terminal.",
    installUrl: "https://github.com/CommandCodeAI/command-code",
  },
  agoragentic: {
    description: "Marketplace for AI capabilities and agent services.",
    installUrl: "https://agoragentic.ai",
  },
  auggie: {
    description: "Augment Code's context-aware software engineering agent.",
    installUrl: "https://docs.augmentcode.com/cli",
  },
  autohand: {
    description: "AI coding agent powered by Autohand AI.",
    installUrl: "https://autohand.ai",
  },
  codebuddy: {
    description: "Tencent Cloud's intelligent coding assistant.",
    installUrl: "https://www.codebuddy.ai",
  },
  codewhale: {
    description: "Terminal coding agent for DeepSeek and open models.",
  },
  cortex: {
    description: "Snowflake Cortex Code agent for software development.",
    installUrl: "https://docs.snowflake.com/en/user-guide/cortex-code",
  },
  corust: {
    description: "Rust-focused co-building agent for terminal workflows.",
  },
  crow: {
    description: "Minimal ACP-native coding agent for terminal development.",
  },
  deepagents: {
    description: "General-purpose coding agent powered by LangChain.",
    installUrl: "https://docs.langchain.com/oss/python/deepagents/overview",
  },
  devin: {
    description: "Devin's terminal coding agent via Agent Client Protocol.",
    installUrl: "https://devin.ai",
  },
  dimcode: {
    description: "Coding agent that puts leading models at your command.",
  },
  dirac: {
    description: "Open-source coding agent optimized for fast parallel edits.",
  },
  "factory-droid": {
    description: "Factory Droid software engineering agent.",
    installUrl: "https://docs.factory.ai/cli",
  },
  "fast-agent": {
    description: "Multi-provider framework for building and running agents.",
    installUrl: "https://github.com/evalstate/fast-agent",
  },
  glm: {
    description: "Zhipu GLM coding agent with streaming and tool calls.",
    installUrl: "https://docs.z.ai/guides/coding-plan/overview",
  },
  hermes: {
    description: "Nous Research self-improving AI agent.",
    installUrl: "https://github.com/NousResearch/hermes-agent",
  },
  junie: {
    description: "JetBrains AI coding agent for software projects.",
    installUrl: "https://www.jetbrains.com/junie/",
  },
  kilo: {
    description: "Open-source coding agent for terminal development.",
    installUrl: "https://kilo.ai/docs",
  },
  minion: {
    description: "AI code assistant with rich development tools.",
  },
  "mistral-vibe": {
    description: "Mistral's open-source coding assistant.",
    installUrl: "https://github.com/mistralai/mistral-vibe",
  },
  nova: {
    description: "Compass AI software engineering agent.",
  },
  poolside: {
    description: "Poolside's coding agent for software development.",
    installUrl: "https://poolside.ai",
  },
  qoder: {
    description: "AI coding assistant with agentic development capabilities.",
    installUrl: "https://qoder.com",
  },
  sigit: {
    description: "Local-first coding agent with optional on-device inference.",
  },
  stakpak: {
    description: "Open-source DevOps agent written in Rust.",
    installUrl: "https://stakpak.dev",
  },
  trae: {
    description: "ByteDance TRAE coding agent with native ACP support.",
    installUrl: "https://www.trae.ai",
  },
  "vt-code": {
    description: "Open-source coding agent with LLM-native code understanding.",
    installUrl: "https://github.com/vinhnx/vtcode",
  },
};

const kimiLaunch =
  'source "$HOME/.zshrc" 2>/dev/null || true; hash -r 2>/dev/null || true; export PATH="$HOME/.kimi-code/bin:$HOME/.local/bin:$PATH"; kimi';
const grokLaunch =
  'source "$HOME/.zshrc" 2>/dev/null || true; hash -r 2>/dev/null || true; export PATH="$HOME/.local/bin:$PATH"; grok';

const UNATTENDED_LAUNCH_FLAGS: Partial<Record<CliAgent, string>> = {
  claude: "--dangerously-skip-permissions",
  codex: "--dangerously-bypass-approvals-and-sandbox",
  opencode: "--auto",
  cmd: "--dangerously-skip-permissions",
};

function unattendedLaunch(agent: CliAgent, baseLaunch: string): string {
  const flag = UNATTENDED_LAUNCH_FLAGS[agent];
  if (!flag) throw new Error(`Missing unattended launch flag for ${agent}`);
  return `${baseLaunch} ${flag}`;
}

const claudeLaunch = unattendedLaunch("claude", "claude");
const codexLaunch = unattendedLaunch("codex", "codex");
const opencodeLaunch = unattendedLaunch("opencode", "opencode");
const commandCodeLaunch = unattendedLaunch("cmd", "cmd");

export const CLI_AGENT_DEFINITIONS: readonly CliAgentDefinition[] = [
  { id: "claude", name: "Claude Code", executable: "claude", command: claudeLaunch, launch: claudeLaunch, launchPolicy: "unattended", chatTransport: "claude-json", bannerPatterns: [/\bclaude code\b/i] },
  { id: "codex", name: "Codex", executable: "codex", command: codexLaunch, launch: codexLaunch, launchPolicy: "unattended", chatTransport: "codex-app-server", bannerPatterns: [/\bopenai codex\b/i] },
  { id: "gemini", name: "Gemini CLI", executable: "gemini", command: "gemini", launch: "gemini", launchPolicy: "standard", bannerPatterns: [/\bgemini cli\b/i] },
  { id: "opencode", name: "OpenCode", executable: "opencode", command: opencodeLaunch, launch: opencodeLaunch, launchPolicy: "unattended", bannerPatterns: [/\bopencode\b/i] },
  { id: "copilot", name: "GitHub Copilot", executable: "copilot", command: "copilot", launch: "copilot", launchPolicy: "standard", bannerPatterns: [/\bgithub copilot\b/i, /\bcopilot cli\b/i] },
  { id: "cursor", name: "Cursor Agent", executable: "cursor-agent", command: "cursor-agent", launch: "cursor-agent", launchPolicy: "standard", bannerPatterns: [/\bcursor agent\b/i] },
  { id: "aider", name: "Aider", executable: "aider", command: "aider", launch: "aider", launchPolicy: "standard", bannerPatterns: [/\baider\b/i] },
  { id: "pi", name: "Pi Coding Agent", executable: "pi", command: "pi", launch: "pi", launchPolicy: "standard", bannerPatterns: [/\bpi coding agent\b/i] },
  { id: "omp", name: "omp", executable: "omp", command: "omp", launch: "omp", launchPolicy: "standard", chatTransport: "omp-rpc", bannerPatterns: [/\bomp(?:\.sh)?\b/i] },
  { id: "amp", name: "Amp CLI", executable: "amp", command: "amp", launch: "amp", launchPolicy: "standard", bannerPatterns: [/\bamp cli\b/i, /\bsourcegraph amp\b/i] },
  { id: "cline", name: "Cline CLI", executable: "cline", command: "cline", launch: "cline", launchPolicy: "standard", bannerPatterns: [/\bcline cli\b/i] },
  { id: "goose", name: "Goose", executable: "goose", command: "goose", launch: "goose", launchPolicy: "standard", bannerPatterns: [/\bgoose\b/i] },
  { id: "qwen", name: "Qwen Code", executable: "qwen", command: "qwen", launch: "qwen", launchPolicy: "standard", bannerPatterns: [/\bqwen code\b/i] },
  { id: "kimi", name: "Kimi Code", executable: "kimi", command: "kimi", launch: kimiLaunch, launchPolicy: "standard", bannerPatterns: [/\bkimi code\b/i] },
  { id: "openhands", name: "OpenHands CLI", executable: "openhands", command: "openhands", launch: "openhands", launchPolicy: "standard", bannerPatterns: [/\bopenhands\b/i] },
  { id: "kiro", name: "Kiro CLI", executable: "kiro-cli", command: "kiro-cli", launch: "kiro-cli", launchPolicy: "standard", bannerPatterns: [/\bkiro cli\b/i] },
  { id: "grok", name: "Grok CLI", executable: "grok", command: "grok", launch: grokLaunch, launchPolicy: "standard", bannerPatterns: [/\bgrok(?: code| cli)\b/i] },
  { id: "herdr", name: "Herdr", executable: "herdr", command: "herdr", launch: "herdr", launchPolicy: "standard", bannerPatterns: [/\bherdr\b/i] },
  { id: "cmd", name: "Command Code", executable: "cmd", command: commandCodeLaunch, launch: commandCodeLaunch, launchPolicy: "unattended", chatTransport: "command-code-json", bannerPatterns: [/\bcommand code\b/i] },
  { id: "agoragentic", name: "Agoragentic", executable: "agoragentic", command: "agoragentic", launch: "agoragentic", launchPolicy: "standard", bannerPatterns: [/\bagoragentic\b/i] },
  { id: "auggie", name: "Auggie CLI", executable: "auggie", command: "auggie", launch: "auggie", launchPolicy: "standard", bannerPatterns: [/\bauggie(?: cli)?\b/i] },
  { id: "autohand", name: "Autohand Code", executable: "autohand", command: "autohand", launch: "autohand", launchPolicy: "standard", bannerPatterns: [/\bautohand(?: code)?\b/i] },
  { id: "codebuddy", name: "Codebuddy Code", executable: "codebuddy", command: "codebuddy", launch: "codebuddy", launchPolicy: "standard", bannerPatterns: [/\bcodebuddy(?: code)?\b/i] },
  { id: "codewhale", name: "CodeWhale", executable: "codewhale", command: "codewhale", launch: "codewhale", launchPolicy: "standard", bannerPatterns: [/\bcodewhale\b/i] },
  { id: "cortex", name: "Cortex Code", executable: "cortex", command: "cortex", launch: "cortex", launchPolicy: "standard", bannerPatterns: [/\bcortex code\b/i] },
  { id: "corust", name: "Corust Agent", executable: "corust", command: "corust", launch: "corust", launchPolicy: "standard", bannerPatterns: [/\bcorust(?: agent)?\b/i] },
  { id: "crow", name: "crow-cli", executable: "crow", command: "crow", launch: "crow", launchPolicy: "standard", bannerPatterns: [/\bcrow(?:-cli)?\b/i] },
  { id: "deepagents", name: "DeepAgents", executable: "deepagents", command: "deepagents", launch: "deepagents", launchPolicy: "standard", bannerPatterns: [/\bdeepagents\b/i] },
  { id: "devin", name: "Devin CLI", executable: "devin", command: "devin", launch: "devin", launchPolicy: "standard", bannerPatterns: [/\bdevin(?: cli)?\b/i] },
  { id: "dimcode", name: "DimCode", executable: "dimcode", command: "dimcode", launch: "dimcode", launchPolicy: "standard", bannerPatterns: [/\bdimcode\b/i] },
  { id: "dirac", name: "Dirac", executable: "dirac", command: "dirac", launch: "dirac", launchPolicy: "standard", bannerPatterns: [/\bdirac\b/i] },
  { id: "factory-droid", name: "Factory Droid", executable: "droid", command: "droid", launch: "droid", launchPolicy: "standard", bannerPatterns: [/\bfactory droid\b/i] },
  { id: "fast-agent", name: "fast-agent", executable: "fast-agent", command: "fast-agent", launch: "fast-agent", launchPolicy: "standard", bannerPatterns: [/\bfast-agent\b/i] },
  { id: "glm", name: "GLM Agent", executable: "glm", command: "glm", launch: "glm", launchPolicy: "standard", bannerPatterns: [/\bglm agent\b/i] },
  { id: "hermes", name: "Hermes", executable: "hermes", command: "hermes", launch: "hermes", launchPolicy: "standard", bannerPatterns: [/\bhermes\b/i] },
  { id: "junie", name: "Junie", executable: "junie", command: "junie", launch: "junie", launchPolicy: "standard", bannerPatterns: [/\bjunie\b/i] },
  { id: "kilo", name: "Kilo", executable: "kilo", command: "kilo", launch: "kilo", launchPolicy: "standard", bannerPatterns: [/\bkilo\b/i] },
  { id: "minion", name: "Minion Code", executable: "minion", command: "minion", launch: "minion", launchPolicy: "standard", bannerPatterns: [/\bminion(?: code)?\b/i] },
  { id: "mistral-vibe", name: "Mistral Vibe", executable: "vibe", command: "vibe", launch: "vibe", launchPolicy: "standard", bannerPatterns: [/\bmistral vibe\b/i] },
  { id: "nova", name: "Nova", executable: "nova", command: "nova", launch: "nova", launchPolicy: "standard", bannerPatterns: [/\bnova\b/i] },
  { id: "poolside", name: "Poolside", executable: "poolside", command: "poolside", launch: "poolside", launchPolicy: "standard", bannerPatterns: [/\bpoolside\b/i] },
  { id: "qoder", name: "Qoder CLI", executable: "qoder", command: "qoder", launch: "qoder", launchPolicy: "standard", bannerPatterns: [/\bqoder(?: cli)?\b/i] },
  { id: "sigit", name: "siGit Code", executable: "sigit", command: "sigit", launch: "sigit", launchPolicy: "standard", bannerPatterns: [/\bsigit code\b/i] },
  { id: "stakpak", name: "Stakpak", executable: "stakpak", command: "stakpak", launch: "stakpak", launchPolicy: "standard", bannerPatterns: [/\bstakpak\b/i] },
  { id: "trae", name: "TRAE CLI", executable: "trae", command: "trae", launch: "trae", launchPolicy: "standard", bannerPatterns: [/\btrae(?: cli)?\b/i] },
  { id: "vt-code", name: "VT Code", executable: "vt", command: "vt", launch: "vt", launchPolicy: "standard", bannerPatterns: [/\bvt code\b/i] },
];

export const CLI_AGENT_BY_ID = Object.fromEntries(
  CLI_AGENT_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<CliAgent, CliAgentDefinition>;

export const CLI_AGENT_CATALOG: readonly CliAgentCatalogEntry[] =
  CLI_AGENT_DEFINITIONS.map((definition) => ({
    ...definition,
    ...CLI_AGENT_CATALOG_META[definition.id],
  }));

const CLI_AGENT_ID_SET = new Set<string>(CLI_AGENT_IDS);

export function normalizeCliAgentIds(
  values: readonly string[] | null | undefined,
): CliAgent[] {
  const seen = new Set<CliAgent>();
  const normalized: CliAgent[] = [];
  for (const value of values ?? []) {
    if (!CLI_AGENT_ID_SET.has(value)) continue;
    const id = value as CliAgent;
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

export function getEnabledCliAgentDefinitions(
  configuredIds: readonly string[],
  disabledIds: readonly string[],
): CliAgentDefinition[] {
  const disabled = new Set(normalizeCliAgentIds(disabledIds));
  return normalizeCliAgentIds(configuredIds).flatMap((id) => {
    const definition = CLI_AGENT_BY_ID[id];
    return disabled.has(id) ? [] : [definition];
  });
}

export function filterCliAgentCatalog(
  configuredIds: readonly string[],
  query: string,
): CliAgentCatalogEntry[] {
  const configured = new Set(normalizeCliAgentIds(configuredIds));
  const normalizedQuery = query.trim().toLowerCase();
  return CLI_AGENT_CATALOG.filter((entry) => !configured.has(entry.id)).filter(
    (entry) =>
      !normalizedQuery ||
      [entry.name, entry.id, entry.executable, entry.description].some((value) =>
        value.toLowerCase().includes(normalizedQuery),
      ),
  );
}

export function detectCliAgent(command?: string): CliAgent | null {
  if (!command) return null;
  return matchCliAgentByExecutable(command, CLI_AGENT_DEFINITIONS);
}

export function detectTrackedCliAgent(
  trackedCommand?: string,
  savedCommand?: string,
): CliAgent | null {
  if (trackedCommand) {
    const detected = detectCliAgent(trackedCommand);
    if (detected) return detected;
    const trackedId = normalizeCliAgentIds([trackedCommand])[0];
    if (trackedId) return trackedId;
  }
  return detectCliAgent(savedCommand);
}

export function isInteractiveCodingAgentCommand(command?: string): boolean {
  return detectCliAgent(command) !== null;
}

export function detectCodingAgentBanner(text: string): CliAgent | null {
  return matchCliAgentBannerPattern(text, CLI_AGENT_DEFINITIONS);
}

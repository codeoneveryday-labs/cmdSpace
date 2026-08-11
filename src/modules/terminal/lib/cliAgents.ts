export const CLI_AGENT_IDS = [
  "claude",
  "codex",
  "gemini",
  "opencode",
  "copilot",
  "cursor",
  "aider",
  "pi",
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
] as const;

export type CliAgent = (typeof CLI_AGENT_IDS)[number];

export type CliAgentLaunchPolicy = "standard" | "unattended";

export type CliAgentDefinition = {
  id: CliAgent;
  name: string;
  executable: string;
  command: string;
  launch: string;
  launchPolicy: CliAgentLaunchPolicy;
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
  { id: "claude", name: "Claude Code", executable: "claude", command: claudeLaunch, launch: claudeLaunch, launchPolicy: "unattended", bannerPatterns: [/\bclaude code\b/i] },
  { id: "codex", name: "Codex", executable: "codex", command: codexLaunch, launch: codexLaunch, launchPolicy: "unattended", bannerPatterns: [/\bopenai codex\b/i] },
  { id: "gemini", name: "Gemini CLI", executable: "gemini", command: "gemini", launch: "gemini", launchPolicy: "standard", bannerPatterns: [/\bgemini cli\b/i] },
  { id: "opencode", name: "OpenCode", executable: "opencode", command: opencodeLaunch, launch: opencodeLaunch, launchPolicy: "unattended", bannerPatterns: [/\bopencode\b/i] },
  { id: "copilot", name: "GitHub Copilot", executable: "copilot", command: "copilot", launch: "copilot", launchPolicy: "standard", bannerPatterns: [/\bgithub copilot\b/i, /\bcopilot cli\b/i] },
  { id: "cursor", name: "Cursor Agent", executable: "cursor-agent", command: "cursor-agent", launch: "cursor-agent", launchPolicy: "standard", bannerPatterns: [/\bcursor agent\b/i] },
  { id: "aider", name: "Aider", executable: "aider", command: "aider", launch: "aider", launchPolicy: "standard", bannerPatterns: [/\baider\b/i] },
  { id: "pi", name: "Pi Coding Agent", executable: "pi", command: "pi", launch: "pi", launchPolicy: "standard", bannerPatterns: [/\bpi coding agent\b/i] },
  { id: "amp", name: "Amp CLI", executable: "amp", command: "amp", launch: "amp", launchPolicy: "standard", bannerPatterns: [/\bamp cli\b/i, /\bsourcegraph amp\b/i] },
  { id: "cline", name: "Cline CLI", executable: "cline", command: "cline", launch: "cline", launchPolicy: "standard", bannerPatterns: [/\bcline cli\b/i] },
  { id: "goose", name: "Goose", executable: "goose", command: "goose", launch: "goose", launchPolicy: "standard", bannerPatterns: [/\bgoose\b/i] },
  { id: "qwen", name: "Qwen Code", executable: "qwen", command: "qwen", launch: "qwen", launchPolicy: "standard", bannerPatterns: [/\bqwen code\b/i] },
  { id: "kimi", name: "Kimi Code", executable: "kimi", command: "kimi", launch: kimiLaunch, launchPolicy: "standard", bannerPatterns: [/\bkimi code\b/i] },
  { id: "openhands", name: "OpenHands CLI", executable: "openhands", command: "openhands", launch: "openhands", launchPolicy: "standard", bannerPatterns: [/\bopenhands\b/i] },
  { id: "kiro", name: "Kiro CLI", executable: "kiro-cli", command: "kiro-cli", launch: "kiro-cli", launchPolicy: "standard", bannerPatterns: [/\bkiro cli\b/i] },
  { id: "grok", name: "Grok CLI", executable: "grok", command: "grok", launch: grokLaunch, launchPolicy: "standard", bannerPatterns: [/\bgrok(?: code| cli)\b/i] },
  { id: "herdr", name: "Herdr", executable: "herdr", command: "herdr", launch: "herdr", launchPolicy: "standard", bannerPatterns: [/\bherdr\b/i] },
  { id: "cmd", name: "Command Code", executable: "cmd", command: commandCodeLaunch, launch: commandCodeLaunch, launchPolicy: "unattended", bannerPatterns: [/\bcommand code\b/i] },
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
  const configured = new Set(normalizeCliAgentIds(configuredIds));
  const disabled = new Set(normalizeCliAgentIds(disabledIds));
  return CLI_AGENT_DEFINITIONS.filter(
    ({ id }) => configured.has(id) && !disabled.has(id),
  );
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

function segmentExecutable(segment: string): string | null {
  const words = segment.trim().split(/\s+/);
  let index = 0;
  while (
    words[index] === "command" ||
    words[index] === "exec" ||
    words[index] === "sudo" ||
    words[index]?.includes("=")
  ) {
    index += 1;
  }
  return words[index]?.replace(/^['"]|['"]$/g, "") ?? null;
}

/** True for a segment that launches the Command Code CLI rather than the
 *  Windows built-in `cmd` shell. The bare name and `/c`, `/k`, `/d` shell
 *  invocations are deliberately excluded. */
function isCommandCodeSegment(segment: string): boolean {
  const words = segment.trim().split(/\s+/);
  if (words[0] !== "cmd") return false;
  const arg = words[1];
  if (!arg) return false;
  return arg.startsWith("--");
}

export function detectCliAgent(command?: string): CliAgent | null {
  if (!command) return null;
  const segments = command
    .split(/&&|\|\||[;|\n]/)
    .map((segment) => segment.trim())
    .filter(Boolean);
  return (
    CLI_AGENT_DEFINITIONS.find(({ executable, id }) =>
      segments.some((segment) => {
        if (segmentExecutable(segment) !== executable) return false;
        if (id === "cmd") return isCommandCodeSegment(segment);
        return true;
      }),
    )?.id ?? null
  );
}

export function isInteractiveCodingAgentCommand(command?: string): boolean {
  return detectCliAgent(command) !== null;
}

export function detectCodingAgentBanner(text: string): CliAgent | null {
  return (
    CLI_AGENT_DEFINITIONS.find(({ bannerPatterns }) =>
      bannerPatterns.some((pattern) => pattern.test(text)),
    )?.id ?? null
  );
}

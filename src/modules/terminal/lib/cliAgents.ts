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
  "cmd",
] as const;

export type CliAgent = (typeof CLI_AGENT_IDS)[number];

export type CliAgentDefinition = {
  id: CliAgent;
  name: string;
  executable: string;
  command: string;
  launch: string;
  bannerPatterns: RegExp[];
};

const kimiLaunch =
  'source "$HOME/.zshrc" 2>/dev/null || true; hash -r 2>/dev/null || true; export PATH="$HOME/.kimi-code/bin:$HOME/.local/bin:$PATH"; kimi';
const grokLaunch =
  'source "$HOME/.zshrc" 2>/dev/null || true; hash -r 2>/dev/null || true; export PATH="$HOME/.local/bin:$PATH"; grok';

export const CLI_AGENT_DEFINITIONS: readonly CliAgentDefinition[] = [
  { id: "claude", name: "Claude Code", executable: "claude", command: "claude --dangerously-skip-permissions", launch: "claude --dangerously-skip-permissions", bannerPatterns: [/\bclaude code\b/i] },
  { id: "codex", name: "Codex", executable: "codex", command: "codex --dangerously-bypass-approvals-and-sandbox", launch: "codex --dangerously-bypass-approvals-and-sandbox", bannerPatterns: [/\bopenai codex\b/i] },
  { id: "gemini", name: "Gemini CLI", executable: "gemini", command: "gemini", launch: "gemini", bannerPatterns: [/\bgemini cli\b/i] },
  { id: "opencode", name: "OpenCode", executable: "opencode", command: "opencode --auto", launch: "opencode --auto", bannerPatterns: [/\bopencode\b/i] },
  { id: "copilot", name: "GitHub Copilot", executable: "copilot", command: "copilot", launch: "copilot", bannerPatterns: [/\bgithub copilot\b/i, /\bcopilot cli\b/i] },
  { id: "cursor", name: "Cursor Agent", executable: "cursor-agent", command: "cursor-agent", launch: "cursor-agent", bannerPatterns: [/\bcursor agent\b/i] },
  { id: "aider", name: "Aider", executable: "aider", command: "aider", launch: "aider", bannerPatterns: [/\baider\b/i] },
  { id: "pi", name: "Pi Coding Agent", executable: "pi", command: "pi", launch: "pi", bannerPatterns: [/\bpi coding agent\b/i] },
  { id: "amp", name: "Amp CLI", executable: "amp", command: "amp", launch: "amp", bannerPatterns: [/\bamp cli\b/i, /\bsourcegraph amp\b/i] },
  { id: "cline", name: "Cline CLI", executable: "cline", command: "cline", launch: "cline", bannerPatterns: [/\bcline cli\b/i] },
  { id: "goose", name: "Goose", executable: "goose", command: "goose", launch: "goose", bannerPatterns: [/\bgoose\b/i] },
  { id: "qwen", name: "Qwen Code", executable: "qwen", command: "qwen", launch: "qwen", bannerPatterns: [/\bqwen code\b/i] },
  { id: "kimi", name: "Kimi Code", executable: "kimi", command: "kimi", launch: kimiLaunch, bannerPatterns: [/\bkimi code\b/i] },
  { id: "openhands", name: "OpenHands CLI", executable: "openhands", command: "openhands", launch: "openhands", bannerPatterns: [/\bopenhands\b/i] },
  { id: "kiro", name: "Kiro CLI", executable: "kiro-cli", command: "kiro-cli", launch: "kiro-cli", bannerPatterns: [/\bkiro cli\b/i] },
  { id: "grok", name: "Grok CLI", executable: "grok", command: "grok", launch: grokLaunch, bannerPatterns: [/\bgrok(?: code| cli)\b/i] },
  { id: "cmd", name: "Command Code", executable: "cmd", command: "cmd --dangerously-skip-permissions", launch: "cmd --dangerously-skip-permissions", bannerPatterns: [/\bcommand code\b/i] },
];

export const CLI_AGENT_BY_ID = Object.fromEntries(
  CLI_AGENT_DEFINITIONS.map((definition) => [definition.id, definition]),
) as Record<CliAgent, CliAgentDefinition>;

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

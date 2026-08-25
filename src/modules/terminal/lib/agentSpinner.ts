export type AgentSpinnerState = "working" | "blocked" | "idle";

const CODEX_SPINNER = /(?:^| )[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏](?: |$)/u;
const CLAUDE_SPINNER = /^[\u{2800}-\u{28FF}\u{25D0}-\u{25D3}] /u;
const GENERIC_SPINNER = /[\u{2800}-\u{28FF}\u{25D0}-\u{25D3}]/u;

function latestOscTitle(input: string): string | null {
  const matches = [...input.matchAll(/\x1b\](?:0|2);([^\x07\x1b]*)(?:\x07|\x1b\\)/g)];
  return matches.length > 0 ? matches[matches.length - 1][1] : null;
}

/** Detect the agent-owned working/blocked spinner signals that Swarmterm reads. */
export function detectAgentSpinnerState(input: string): AgentSpinnerState | null {
  const title = latestOscTitle(input);
  if (title?.includes("Action Required")) return "blocked";
  if (title && (CODEX_SPINNER.test(title) || CLAUDE_SPINNER.test(title) || GENERIC_SPINNER.test(title))) {
    return "working";
  }

  if (/^[•◦]\s+Working \([^)]*esc to interrupt\)/m.test(input)) {
    return "working";
  }
  if (/esc to interrupt|ctrl\+c to interrupt|press esc to interrupt|thinking(?:\.\.\.|…)|generating(?:\.\.\.|…)|working(?:\.\.\.|…)/i.test(input)) {
    return "working";
  }
  if (/(?:△\s*Permission required|enter to submit answer|allow command\?)/i.test(input)) {
    return "blocked";
  }
  return null;
}

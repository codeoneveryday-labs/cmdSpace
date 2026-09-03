import { detectAgentSpinnerState, type AgentSpinnerState } from "./agentSpinner";
import { detectCliAgent, detectCodingAgentBanner } from "./cliAgents";

const AGENT_OUTPUT_TAIL_LIMIT = 512;

export type TerminalOutputState = {
  agentOutputTail: string;
  interactiveCodingAgent: boolean;
  launchCommand: string | undefined;
};

export type TerminalOutputResult = {
  state: TerminalOutputState;
  output: string;
  detectedAgent: string | null;
  agentStarted: boolean;
  spinnerState: AgentSpinnerState | null;
  outputIsUserEcho: boolean;
};

export function processTerminalOutput(
  current: TerminalOutputState,
  chunk: string,
  now: number,
  lastLocalInputAt: number,
): TerminalOutputResult {
  const output = current.agentOutputTail + chunk;
  // Once a command identifies a known CLI, its launch command is the source
  // of truth. Agent output is untrusted transcript text and may mention a
  // different CLI (for example, Claude explaining how Aider works); allowing
  // that text to replace the launch command makes the sidebar logo drift.
  const launchedAgent = detectCliAgent(current.launchCommand);
  const detectedAgent = launchedAgent ? null : detectCodingAgentBanner(output);
  const agent = launchedAgent ?? detectedAgent;
  const agentStarted = detectedAgent !== null && !current.interactiveCodingAgent;
  const state: TerminalOutputState = {
    agentOutputTail: output.slice(-AGENT_OUTPUT_TAIL_LIMIT),
    interactiveCodingAgent: current.interactiveCodingAgent || agent !== null,
    launchCommand: current.launchCommand ?? agent ?? undefined,
  };

  return {
    state,
    output,
    detectedAgent,
    agentStarted,
    spinnerState: state.interactiveCodingAgent
      ? detectAgentSpinnerState(output)
      : null,
    outputIsUserEcho: now - lastLocalInputAt < 180,
  };
}

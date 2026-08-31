import { detectAgentSpinnerState, type AgentSpinnerState } from "./agentSpinner";
import { detectCodingAgentBanner } from "./cliAgents";

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
  const detectedAgent = detectCodingAgentBanner(output);
  const agentStarted = detectedAgent !== null && !current.interactiveCodingAgent;
  const state: TerminalOutputState = {
    agentOutputTail: output.slice(-AGENT_OUTPUT_TAIL_LIMIT),
    interactiveCodingAgent: current.interactiveCodingAgent || detectedAgent !== null,
    launchCommand: detectedAgent ?? current.launchCommand,
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

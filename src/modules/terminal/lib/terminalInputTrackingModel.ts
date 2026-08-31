export type TerminalInputTrackingState = {
  inputBuffer: string;
  agentLaunchBuffer: string;
  interactiveCodingAgent: boolean;
};

export type TerminalInputTrackingEvent =
  | { type: "agent-response-requested" }
  | { type: "command-submitted"; command: string; interactive: boolean };

export type TerminalInputTrackingResult = {
  state: TerminalInputTrackingState;
  events: TerminalInputTrackingEvent[];
};

type Options = {
  inCommand: boolean;
  isInteractiveCodingAgentCommand: (command: string) => boolean;
};

function updateBuffer(buffer: string, data: string): string {
  let next = buffer;
  for (const char of data) {
    if (char === "\x7f" || char === "\b") {
      next = next.slice(0, -1);
    } else if (char === "\u0015" || char === "\u0003") {
      next = "";
    } else if (char.charCodeAt(0) >= 32) {
      next += char;
    }
  }
  return next;
}

export function trackTerminalInput(
  current: TerminalInputTrackingState,
  data: string,
  { inCommand, isInteractiveCodingAgentCommand }: Options,
): TerminalInputTrackingResult {
  const state = { ...current };
  const events: TerminalInputTrackingEvent[] = [];
  const submitted = data.includes("\r") || data.includes("\n");
  const [beforeEnter = ""] = data.split(/[\r\n]+/);

  if (inCommand) {
    if (state.interactiveCodingAgent) {
      if (submitted) {
        events.push({ type: "agent-response-requested" });
        state.agentLaunchBuffer = "";
      }
      return { state, events };
    }

    if (submitted) {
      const command = (state.agentLaunchBuffer + beforeEnter).trim();
      if (isInteractiveCodingAgentCommand(command)) {
        state.interactiveCodingAgent = true;
        state.agentLaunchBuffer = "";
        events.push({ type: "command-submitted", command, interactive: true });
      } else {
        state.agentLaunchBuffer = "";
      }
      return { state, events };
    }

    state.agentLaunchBuffer = updateBuffer(state.agentLaunchBuffer, data);
    return { state, events };
  }

  if (state.interactiveCodingAgent) {
    if (submitted) {
      events.push({ type: "agent-response-requested" });
      state.inputBuffer = "";
    }
    return { state, events };
  }

  if (submitted) {
    const command = (state.inputBuffer + beforeEnter).trim();
    if (command.length > 0) {
      const interactive = isInteractiveCodingAgentCommand(command);
      state.interactiveCodingAgent = interactive;
      events.push({ type: "command-submitted", command, interactive });
    }
    state.inputBuffer = "";
    return { state, events };
  }

  state.inputBuffer = updateBuffer(state.inputBuffer, data);
  return { state, events };
}

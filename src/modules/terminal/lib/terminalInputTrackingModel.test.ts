import { describe, expect, it } from "vitest";
import { trackTerminalInput, type TerminalInputTrackingState } from "./terminalInputTrackingModel";

const idle: TerminalInputTrackingState = {
  inputBuffer: "",
  agentLaunchBuffer: "",
  interactiveCodingAgent: false,
};
const isAgent = (command: string) => command === "codex";

describe("terminalInputTrackingModel", () => {
  it("tracks a shell command and classifies an interactive agent", () => {
    const typed = trackTerminalInput(idle, "codex", {
      inCommand: false,
      isInteractiveCodingAgentCommand: isAgent,
    });
    const submitted = trackTerminalInput(typed.state, "\r", {
      inCommand: false,
      isInteractiveCodingAgentCommand: isAgent,
    });

    expect(submitted.state.interactiveCodingAgent).toBe(true);
    expect(submitted.events).toEqual([
      { type: "command-submitted", command: "codex", interactive: true },
    ]);
  });

  it("tracks agent launch input while the shell is executing", () => {
    const result = trackTerminalInput(idle, "codex\r", {
      inCommand: true,
      isInteractiveCodingAgentCommand: isAgent,
    });

    expect(result.events).toEqual([
      { type: "command-submitted", command: "codex", interactive: true },
    ]);
  });

  it("does not classify an ordinary running command as an agent", () => {
    const result = trackTerminalInput(idle, "pnpm test\r", {
      inCommand: true,
      isInteractiveCodingAgentCommand: isAgent,
    });

    expect(result.events).toEqual([]);
    expect(result.state.interactiveCodingAgent).toBe(false);
  });

  it("emits a response event when an interactive agent receives Enter", () => {
    const result = trackTerminalInput(
      { ...idle, interactiveCodingAgent: true, inputBuffer: "question" },
      "\r",
      { inCommand: false, isInteractiveCodingAgentCommand: isAgent },
    );

    expect(result.events).toEqual([{ type: "agent-response-requested" }]);
    expect(result.state.inputBuffer).toBe("");
  });

  it("preserves editing controls in the tracked buffer", () => {
    const result = trackTerminalInput(
      { ...idle, inputBuffer: "abc" },
      "\b\u0015x",
      { inCommand: false, isInteractiveCodingAgentCommand: isAgent },
    );

    expect(result.state.inputBuffer).toBe("x");
  });
});

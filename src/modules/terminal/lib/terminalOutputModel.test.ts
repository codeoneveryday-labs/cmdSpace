import { describe, expect, it } from "vitest";
import { processTerminalOutput, type TerminalOutputState } from "./terminalOutputModel";

const idle: TerminalOutputState = {
  agentOutputTail: "",
  interactiveCodingAgent: false,
  launchCommand: undefined,
};

describe("terminalOutputModel", () => {
  it("keeps a bounded tail and detects an agent banner", () => {
    const result = processTerminalOutput(idle, `${"x".repeat(600)}\nOpenAI Codex`, 1000, 0);

    expect(result.state.agentOutputTail.length).toBe(512);
    expect(result.state.interactiveCodingAgent).toBe(true);
    expect(result.detectedAgent).toBe("codex");
    expect(result.agentStarted).toBe(true);
  });

  it("does not report an already-known agent as newly started", () => {
    const result = processTerminalOutput(
      { ...idle, interactiveCodingAgent: true, launchCommand: "codex" },
      "spinner",
      1000,
      0,
    );

    expect(result.agentStarted).toBe(false);
    expect(result.state.launchCommand).toBe("codex");
  });

  it("classifies a recent local echo separately from agent output", () => {
    expect(processTerminalOutput(idle, "output", 1000, 900).outputIsUserEcho).toBe(true);
    expect(processTerminalOutput(idle, "output", 1000, 700).outputIsUserEcho).toBe(false);
  });
});

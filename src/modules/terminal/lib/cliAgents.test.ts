import { describe, expect, it } from "vitest";
import {
  CLI_AGENT_DEFINITIONS,
  detectCliAgent,
  isInteractiveCodingAgentCommand,
} from "./cliAgents";

describe("CLI agent registry", () => {
  it("recognizes every supported agent executable", () => {
    const expected = {
      claude: "claude",
      codex: "codex",
      gemini: "gemini",
      opencode: "opencode",
      copilot: "copilot",
      cursor: "cursor-agent",
      aider: "aider",
      pi: "pi",
      amp: "amp",
      cline: "cline",
      goose: "goose",
      qwen: "qwen",
      kimi: "kimi",
      openhands: "openhands",
      kiro: "kiro-cli",
      grok: "grok",
      cmd: "cmd --dangerously-skip-permissions",
    } as const;

    expect(CLI_AGENT_DEFINITIONS.map(({ id }) => id)).toEqual(
      Object.keys(expected),
    );
    for (const [agent, command] of Object.entries(expected)) {
      expect(detectCliAgent(command)).toBe(agent);
      expect(isInteractiveCodingAgentCommand(`cd ~/dev; ${command}`)).toBe(true);
    }
  });

  it("does not confuse ordinary shell commands with agent commands", () => {
    expect(detectCliAgent("echo codex")).toBeNull();
    expect(detectCliAgent("open cursor-agent.log")).toBeNull();
    expect(isInteractiveCodingAgentCommand("compile project")).toBe(false);
  });

  it("does not mistake the Windows cmd shell for Command Code", () => {
    expect(detectCliAgent("cmd")).toBeNull();
    expect(detectCliAgent("cmd /c echo hi")).toBeNull();
    expect(detectCliAgent("cmd //c echo hi")).toBeNull();
    expect(detectCliAgent("cmd.exe /c dir")).toBeNull();
    expect(detectCliAgent("cmd --dangerously-skip-permissions")).toBe("cmd");
    expect(detectCliAgent("cd ~; cmd --dangerously-skip-permissions")).toBe(
      "cmd",
    );
  });
});

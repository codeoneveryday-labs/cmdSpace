import { describe, expect, it } from "vitest";
import {
  isCommandCodeCliSegment,
  matchCliAgentBannerPattern,
  matchCliAgentByExecutable,
  parseCommandSegmentExecutable,
  splitCommandSegments,
} from "./cliAgentDetectionModel";
import { CLI_AGENT_DEFINITIONS } from "./cliAgents";

describe("cliAgentDetectionModel", () => {
  it("splits command segments properly", () => {
    expect(splitCommandSegments("cd foo && claude --dangerously-skip-permissions")).toEqual([
      "cd foo",
      "claude --dangerously-skip-permissions",
    ]);
    expect(splitCommandSegments("echo 1; aider || codex")).toEqual([
      "echo 1",
      "aider",
      "codex",
    ]);
  });

  it("parses leading wrappers and environment variables", () => {
    expect(parseCommandSegmentExecutable("sudo claude")).toBe("claude");
    expect(parseCommandSegmentExecutable("FOO=bar BAZ=qux exec aider")).toBe("aider");
    expect(parseCommandSegmentExecutable("command 'gemini'")).toBe("gemini");
  });

  it("matches agent executables against definitions", () => {
    expect(matchCliAgentByExecutable("claude", CLI_AGENT_DEFINITIONS)).toBe("claude");
    expect(matchCliAgentByExecutable("sudo aider --model claude-3-5", CLI_AGENT_DEFINITIONS)).toBe("aider");
    expect(matchCliAgentByExecutable("codex", CLI_AGENT_DEFINITIONS)).toBe("codex");
    expect(matchCliAgentByExecutable("ls -la", CLI_AGENT_DEFINITIONS)).toBeNull();
  });

  it("special-cases cmd CLI segment for Command Code vs Windows cmd.exe", () => {
    expect(isCommandCodeCliSegment("cmd")).toBe(true);
    expect(isCommandCodeCliSegment("cmd --help")).toBe(true);
    expect(isCommandCodeCliSegment("cmd /c dir")).toBe(false);
  });

  it("matches banner patterns from raw terminal output", () => {
    expect(matchCliAgentBannerPattern("Claude Code (research preview)", CLI_AGENT_DEFINITIONS)).toBe("claude");
    expect(matchCliAgentBannerPattern("Welcome to OpenAI Codex CLI", CLI_AGENT_DEFINITIONS)).toBe("codex");
    expect(matchCliAgentBannerPattern("> Ask Codex to do anything", CLI_AGENT_DEFINITIONS)).toBe("codex");
    expect(matchCliAgentBannerPattern("Regular bash output", CLI_AGENT_DEFINITIONS)).toBeNull();
  });

  it("does not mistake a model name for the Muse Code CLI", () => {
    // OpenCode running a Muse Spark model redraws status lines like
    // "Build · Muse Spark 1.3 Free". "Muse Spark" is a model, not the
    // Muse Code CLI banner, so it must not flip the agent to muse.
    expect(matchCliAgentBannerPattern("Build · Muse Spark 1.3 Free", CLI_AGENT_DEFINITIONS)).toBeNull();
    expect(matchCliAgentBannerPattern("Muse Code", CLI_AGENT_DEFINITIONS)).toBe("muse");
  });
});

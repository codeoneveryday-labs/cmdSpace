import { describe, expect, it } from "vitest";
import {
  CLI_AGENT_CATALOG,
  CLI_AGENT_DEFINITIONS,
  DEFAULT_CONFIGURED_CLI_AGENT_IDS,
  detectCliAgent,
  detectTrackedCliAgent,
  filterCliAgentCatalog,
  getEnabledCliAgentDefinitions,
  isInteractiveCodingAgentCommand,
  normalizeCliAgentIds,
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
      omp: "omp",
      amp: "amp",
      cline: "cline",
      goose: "goose",
      qwen: "qwen",
      kimi: "kimi",
      openhands: "openhands",
      kiro: "kiro-cli",
      grok: "grok",
      herdr: "herdr",
      cmd: "cmd --dangerously-skip-permissions",
      agoragentic: "agoragentic",
      auggie: "auggie",
      autohand: "autohand",
      codebuddy: "codebuddy",
      codewhale: "codewhale",
      cortex: "cortex",
      corust: "corust",
      crow: "crow",
      deepagents: "deepagents",
      devin: "devin",
      dimcode: "dimcode",
      dirac: "dirac",
      "factory-droid": "droid",
      "fast-agent": "fast-agent",
      glm: "glm",
      hermes: "hermes",
      junie: "junie",
      kilo: "kilo",
      minion: "minion",
      "mistral-vibe": "vibe",
      nova: "nova",
      poolside: "poolside",
      qoder: "qoder",
      sigit: "sigit",
      stakpak: "stakpak",
      trae: "trae",
      "vt-code": "vt",
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

  it("recognizes bare Command Code while excluding Windows shell switches", () => {
    expect(detectCliAgent("cmd")).toBe("cmd");
    expect(detectCliAgent("cmd /c echo hi")).toBeNull();
    expect(detectCliAgent("cmd //c echo hi")).toBeNull();
    expect(detectCliAgent("cmd.exe /c dir")).toBeNull();
    expect(detectCliAgent("cmd --dangerously-skip-permissions")).toBe("cmd");
    expect(detectCliAgent("cd ~; cmd --dangerously-skip-permissions")).toBe(
      "cmd",
    );
  });

  it("accepts a trusted runtime agent id without treating shell history as an agent", () => {
    expect(detectTrackedCliAgent("cmd", undefined)).toBe("cmd");
    expect(detectTrackedCliAgent(undefined, "cmd")).toBe("cmd");
    expect(detectTrackedCliAgent(undefined, "cmd --dangerously-skip-permissions")).toBe(
      "cmd",
    );
  });

  it("normalizes persisted agent ids without unknowns or duplicates", () => {
    expect(normalizeCliAgentIds(["codex", "unknown", "codex", "claude"])).toEqual([
      "codex",
      "claude",
    ]);
  });

  it("ships a useful default configured set", () => {
    expect(DEFAULT_CONFIGURED_CLI_AGENT_IDS).toEqual([
      "claude",
      "codex",
      "gemini",
      "copilot",
      "opencode",
      "pi",
    ]);
  });

  it("keeps newly added marketplace agents opt-in", () => {
    expect(CLI_AGENT_DEFINITIONS).toHaveLength(46);
    expect(DEFAULT_CONFIGURED_CLI_AGENT_IDS).toHaveLength(6);
    expect(
      CLI_AGENT_DEFINITIONS.filter(
        ({ id }) => !DEFAULT_CONFIGURED_CLI_AGENT_IDS.includes(id),
      ),
    ).toHaveLength(40);
  });

  it("makes unattended launch behavior an explicit catalog policy", () => {
    const claude = CLI_AGENT_DEFINITIONS.find(({ id }) => id === "claude");
    const codex = CLI_AGENT_DEFINITIONS.find(({ id }) => id === "codex");
    const gemini = CLI_AGENT_DEFINITIONS.find(({ id }) => id === "gemini");

    expect(claude).toMatchObject({
      launchPolicy: "unattended",
      launch: "claude --dangerously-skip-permissions",
    });
    expect(codex).toMatchObject({
      launchPolicy: "unattended",
      launch: "codex --dangerously-bypass-approvals-and-sandbox",
    });
    expect(gemini).toMatchObject({
      launchPolicy: "standard",
      launch: "gemini",
    });
  });

  it("filters enabled workspace agents from configured preferences", () => {
    expect(
      getEnabledCliAgentDefinitions(["cursor", "codex", "claude", "cursor"], ["codex"]).map(
        ({ id }) => id,
      ),
    ).toEqual(["cursor", "claude"]);
  });

  it("searches only agents that have not been configured", () => {
    expect(filterCliAgentCatalog(["claude", "codex"], "cursor").map(({ id }) => id)).toEqual([
      "cursor",
    ]);
    expect(filterCliAgentCatalog(["claude"], "coding assistant").length).toBeGreaterThan(0);
  });

  it("links Command Code to its official repository", () => {
    expect(CLI_AGENT_CATALOG.find(({ id }) => id === "cmd")?.installUrl).toBe(
      "https://github.com/CommandCodeAI/command-code",
    );
  });

  it("registers Herdr with its official install guide", () => {
    const herdr = CLI_AGENT_CATALOG.find(({ id }) => id === "herdr");

    expect(herdr?.name).toBe("Herdr");
    expect(herdr?.installUrl).toBe("https://herdr.dev/docs/install/");
    expect(herdr?.launch).toBe("herdr");
  });
});

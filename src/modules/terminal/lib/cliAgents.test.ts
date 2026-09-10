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
  normalizeCliAgentLaunchCommand,
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
      muse: "muse",
      devin: "devin",
      hermes: "hermes",
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
      auggie: "auggie",
      codebuddy: "codebuddy-code",
      cortex: "cortex",
      deepagents: "deepagents",
      glm: "glm",
      junie: "junie",
      "mistral-vibe": "vibe",
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
      "omp",
    ]);
  });

  it("keeps newly added marketplace agents opt-in", () => {
    expect(CLI_AGENT_DEFINITIONS).toHaveLength(29);
    expect(DEFAULT_CONFIGURED_CLI_AGENT_IDS).toHaveLength(7);
    expect(
      CLI_AGENT_DEFINITIONS.filter(
        ({ id }) => !DEFAULT_CONFIGURED_CLI_AGENT_IDS.includes(id),
      ),
    ).toHaveLength(22);
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

  it("launches Kiro through the classic UI for stable PTY keyboard input", () => {
    const kiro = CLI_AGENT_DEFINITIONS.find(({ id }) => id === "kiro");

    expect(kiro).toMatchObject({
      command: "kiro-cli --classic",
      launch: "kiro-cli --classic",
      launchPolicy: "standard",
    });
  });

  it("launches OMP through the shell integration without replaying user zsh startup", () => {
    const omp = CLI_AGENT_DEFINITIONS.find(({ id }) => id === "omp");

    expect(omp).toMatchObject({
      command: "omp",
      launch: "omp",
    });
  });

  it("launches Pi without replaying the PATH bootstrap or the OMP fallback", () => {
    const pi = CLI_AGENT_DEFINITIONS.find(({ id }) => id === "pi");

    expect(pi).toMatchObject({
      command: "pi",
      launch: "pi",
    });
    expect(pi?.launch).not.toContain("command -v pi");
  });

  it("launches Kimi, Grok, and Muse without replaying the zsh bootstrap", () => {
    for (const id of ["kimi", "grok", "muse"] as const) {
      const agent = CLI_AGENT_DEFINITIONS.find((entry) => entry.id === id);
      expect(agent?.command).toBe(id);
      expect(agent?.launch).toBe(id);
    }
  });

  it("normalizes the legacy bootstrap for every agent that shipped one", () => {
    const preamble =
      'source "$HOME/.zshrc" 2>/dev/null || true; hash -r 2>/dev/null || true; ';
    expect(
      normalizeCliAgentLaunchCommand(
        "kimi",
        `${preamble}export PATH="$HOME/.kimi-code/bin:$HOME/.local/bin:$PATH"; kimi`,
      ),
    ).toBe("kimi");
    expect(
      normalizeCliAgentLaunchCommand(
        "grok",
        `${preamble}export PATH="$HOME/.local/bin:$PATH"; grok`,
      ),
    ).toBe("grok");
    expect(
      normalizeCliAgentLaunchCommand(
        "muse",
        `${preamble}export PATH="$HOME/.local/bin:$PATH"; muse`,
      ),
    ).toBe("muse");
    expect(
      normalizeCliAgentLaunchCommand(
        "pi",
        `${preamble}export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"; command -v pi >/dev/null 2>&1 && pi || omp`,
      ),
    ).toBe("pi");
  });

  it("keeps custom launch commands untouched for agents with a legacy bootstrap", () => {
    expect(normalizeCliAgentLaunchCommand("grok", "grok --model test")).toBe(
      "grok --model test",
    );
    expect(normalizeCliAgentLaunchCommand("kimi", "kimi --yolo")).toBe(
      "kimi --yolo",
    );
    expect(normalizeCliAgentLaunchCommand("claude", "claude --fast")).toBe(
      "claude --fast",
    );
  });

  it("migrates the legacy OMP bootstrap without changing custom commands", () => {
    expect(
      normalizeCliAgentLaunchCommand(
        "omp",
        'source "$HOME/.zshrc" 2>/dev/null || true; hash -r 2>/dev/null || true; export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"; omp',
      ),
    ).toBe("omp");
    expect(normalizeCliAgentLaunchCommand("omp", "omp --model test")).toBe(
      "omp --model test",
    );
  });

  it("migrates the legacy Pi fallback bootstrap when it was saved for OMP", () => {
    expect(
      normalizeCliAgentLaunchCommand(
        "omp",
        'source "$HOME/.zshrc" 2>/dev/null || true; hash -r 2>/dev/null || true; export PATH="$HOME/.bun/bin:$HOME/.local/bin:$PATH"; command -v pi >/dev/null 2>&1 && pi || omp',
      ),
    ).toBe("omp");
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

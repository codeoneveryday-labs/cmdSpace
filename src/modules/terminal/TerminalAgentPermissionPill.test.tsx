import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  TerminalAgentPermissionPill,
  detectFastModeFromBuffer,
} from "./TerminalAgentPermissionPill";
import {
  getCliAgentControlProfile,
  executeAgentCommand,
  claudeAgentHandler,
  codexAgentHandler,
} from "./lib/cliAgentControls";
import { isDarkTerminalAgent } from "./lib/cliAgents";

const source = readFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), "TerminalAgentPermissionPill.tsx"),
  "utf8",
);
const controlsSource = readFileSync(
  path.join(path.dirname(new URL(import.meta.url).pathname), "lib/cliAgentControls.ts"),
  "utf8",
);

describe("TerminalAgentPermissionPill", () => {
  it("renders the fast mode toggle and default permissions for Claude", () => {
    const html = renderToStaticMarkup(
      <TerminalAgentPermissionPill agent="claude" onWrite={() => undefined} />,
    );

    expect(html).toContain('aria-label="Toggle fast mode (/fast)"');
    expect(html).toContain('aria-label="Permission mode: /permissions"');
    expect(html).toContain("/permissions");
    expect(html).toContain("Select permission mode");
  });

  it("renders specific permission defaults for Codex without hardcoding", () => {
    const html = renderToStaticMarkup(
      <TerminalAgentPermissionPill agent="codex" onWrite={() => undefined} />,
    );

    // Codex supports /fast and defaults to /permissions
    expect(html).toContain('aria-label="Toggle fast mode (/fast)"');
    expect(html).toContain('aria-label="Permission mode: /permissions"');
    expect(html).toContain("/permissions");
  });

  it("provides tailored controls for the 6 primary CLI providers", () => {
    const providers = ["claude", "codex", "gemini", "copilot", "opencode", "pi"] as const;

    for (const provider of providers) {
      const profile = getCliAgentControlProfile(provider);
      expect(profile.agent).toBe(provider);
      expect(profile.permissions.length).toBeGreaterThan(0);
      expect(profile.defaultPermissionId).toBeTruthy();

      // Ensure every permission option has a valid non-empty command
      for (const opt of profile.permissions) {
        expect(opt.id).toBeTruthy();
        expect(opt.label).toBeTruthy();
        expect(opt.command.length).toBeGreaterThan(0);
      }
    }
  });

  it("uses specific commands per provider rather than hardcoded strings", () => {
    const claudeProfile = getCliAgentControlProfile("claude");
    const codexProfile = getCliAgentControlProfile("codex");
    const geminiProfile = getCliAgentControlProfile("gemini");
    const opencodeProfile = getCliAgentControlProfile("opencode");
    const copilotProfile = getCliAgentControlProfile("copilot");

    // Claude uses /fast, /permissions, /plan, /goal, /config
    expect(claudeProfile.fastMode.command).toBe("/fast\r");
    expect(claudeProfile.permissions.find((p) => p.id === "permissions")?.command).toBe("/permissions\r");
    expect(claudeProfile.permissions.find((p) => p.id === "goal")?.command).toBe("/goal ");
    expect(claudeProfile.permissions.find((p) => p.id === "plan")?.command).toBe("/plan\r");
    expect(claudeProfile.permissions.find((p) => p.id === "config")?.command).toBe("/config\r");

    // Codex uses /fast and /permissions, /plan, /review, /status
    expect(codexProfile.fastMode.command).toBe("/fast\r");
    expect(codexProfile.permissions.find((p) => p.id === "permissions")?.command).toBe(
      "/permissions\r",
    );
    expect(codexProfile.permissions.find((p) => p.id === "review")?.command).toBe(
      "/review\r",
    );
    expect(codexProfile.permissions.find((p) => p.id === "plan")?.command).toBe("/plan\r");

    // Gemini supports yolo, settings, and plan
    expect(geminiProfile.permissions.find((p) => p.id === "yolo")?.command).toBe("/yolo\r");
    expect(geminiProfile.permissions.find((p) => p.id === "settings")?.command).toBe("/settings\r");
    expect(geminiProfile.permissions.find((p) => p.id === "plan")?.command).toBe("/plan\r");

    // OpenCode uses models
    expect(opencodeProfile.permissions.find((p) => p.id === "models")?.command).toBe("/models\r");

    // Copilot uses allow-all
    expect(copilotProfile.permissions.find((p) => p.id === "allow-all")?.command).toBe("/allow-all\r");
  });

  it("isolates pointer events from pane drag handles", () => {
    expect(source).toContain("onPointerDown={(e) => e.stopPropagation()}");
    expect(source).toContain("onClick={(e) => e.stopPropagation()}");
    expect(source).toContain("getCliAgentControlProfile(agent)");
    expect(controlsSource).toContain("CLI_AGENT_CONTROL_PROFILES");
  });

  it("detects fast mode state from terminal output buffer correctly", () => {
    // When fast mode successfully turns on
    expect(detectFastModeFromBuffer("/fast\nFast mode ON\n")).toBe(true);

    // When fast mode is disabled by organization (user screenshot scenario)
    expect(
      detectFastModeFromBuffer(
        "/fast\nFast mode OFF\n⚡ Fast mode\nFast mode has been disabled by your organization\nEsc to cancel",
      ),
    ).toBe(false);

    // When usage credits are missing or unavailable
    expect(
      detectFastModeFromBuffer("/fast\nFast mode requires usage credits"),
    ).toBe(false);

    // When network fails
    expect(
      detectFastModeFromBuffer("/fast\nFast mode unavailable due to network connectivity issues"),
    ).toBe(false);

    // When turned off after being on
    expect(
      detectFastModeFromBuffer("Fast mode ON\n...\n/fast\nFast mode OFF"),
    ).toBe(false);

    // When turned on after being off
    expect(
      detectFastModeFromBuffer("Fast mode OFF\n...\n/fast\nFast mode ON"),
    ).toBe(true);

    // Codex fast mode patterns
    expect(detectFastModeFromBuffer("/fast\nFast mode: on\n")).toBe(true);
    expect(detectFastModeFromBuffer("/fast\nFast tier: on\n")).toBe(true);
    expect(detectFastModeFromBuffer("/fast\nFast mode: off\n")).toBe(false);
    expect(detectFastModeFromBuffer("/fast\nFast mode is not available for this model")).toBe(false);
    expect(detectFastModeFromBuffer("/fast\nModel does not support fast mode")).toBe(false);
    expect(detectFastModeFromBuffer("/fast\nFast mode unavailable due to insufficient credits")).toBe(false);

    // When buffer is empty or doesn't mention fast mode
    expect(detectFastModeFromBuffer(null)).toBeNull();
    expect(detectFastModeFromBuffer("npm run test\nPassed")).toBeNull();
  });

  it("encapsulates agent-specific fast mode logic in claude.ts and codex.ts", () => {
    // Claude handler logic
    expect(claudeAgentHandler.detectFastMode?.("Fast mode ON")).toBe(true);
    expect(
      claudeAgentHandler.detectFastMode?.(
        "Fast mode has been disabled by your organization",
      ),
    ).toBe(false);

    // Codex handler logic
    expect(codexAgentHandler.detectFastMode?.("Fast mode: on")).toBe(true);
    expect(
      codexAgentHandler.detectFastMode?.(
        "Fast mode is not available for this model",
      ),
    ).toBe(false);
  });

  it("submits commands appropriately for Codex (auto-submitting through TUI popup)", async () => {
    const written: string[] = [];
    const onWrite = (data: string) => {
      written.push(data);
    };

    executeAgentCommand("codex", "/permissions\r", onWrite);
    expect(written).toEqual(["/permissions\r"]);

    // After 50ms tick, second Enter is sent to submit prompt
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(written).toEqual(["/permissions\r", "\r"]);
  });

  it("submits commands appropriately for Command Code (auto-submitting through TUI popup)", async () => {
    const written: string[] = [];
    const onWrite = (data: string) => {
      written.push(data);
    };

    executeAgentCommand("cmd", "/mode:default\r", onWrite);
    expect(written).toEqual(["/mode:default\r"]);

    // After 50ms tick, second Enter is sent to submit prompt
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(written).toEqual(["/mode:default\r", "\r"]);
  });

  it("does not auto-submit /goal for claude, codex, cmd, and gemini", async () => {
    for (const agent of ["claude", "codex", "cmd", "gemini"] as const) {
      const written: string[] = [];
      const onWrite = (data: string) => {
        written.push(data);
      };

      executeAgentCommand(agent, "/goal ", onWrite);
      expect(written).toEqual(["/goal "]);

      // Wait 70ms to ensure NO trailing \r is sent
      await new Promise((resolve) => setTimeout(resolve, 70));
      expect(written).toEqual(["/goal "]);
    }
  });

  it("identifies opencode, omp, and pi as dark terminal agents", () => {
    expect(isDarkTerminalAgent("opencode")).toBe(true);
    expect(isDarkTerminalAgent("omp")).toBe(true);
    expect(isDarkTerminalAgent("pi")).toBe(true);
    expect(isDarkTerminalAgent("gemini")).toBe(true);
    expect(isDarkTerminalAgent("herdr")).toBe(true);
    expect(isDarkTerminalAgent("claude")).toBe(false);
  });

  it("configures opencode with models, variants, skills, and thinking, with menu commands auto-submitting and thinking non-submitting", async () => {
    const opencodeProfile = getCliAgentControlProfile("opencode");
    expect(opencodeProfile.permissions.map((p) => p.id)).toEqual([
      "models",
      "variants",
      "skills",
      "thinking",
    ]);

    expect(opencodeProfile.permissions.find((p) => p.id === "models")?.command).toBe("/models\r");
    expect(opencodeProfile.permissions.find((p) => p.id === "variants")?.command).toBe("/variants\r");
    expect(opencodeProfile.permissions.find((p) => p.id === "skills")?.command).toBe("/skills\r");

    // models auto-submits with 2-step Enter (selection + submission)
    const modelsWritten: string[] = [];
    executeAgentCommand("opencode", "/models\r", (data) => modelsWritten.push(data));
    expect(modelsWritten).toEqual(["/models\r"]);
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(modelsWritten).toEqual(["/models\r", "\r"]);

    // skills auto-submits with 2-step Enter (selection + submission)
    const skillsWritten: string[] = [];
    executeAgentCommand("opencode", "/skills\r", (data) => skillsWritten.push(data));
    expect(skillsWritten).toEqual(["/skills\r"]);
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(skillsWritten).toEqual(["/skills\r", "\r"]);

    // variants auto-submits with 2-step Enter (selection + submission)
    const variantsWritten: string[] = [];
    executeAgentCommand("opencode", "/variants\r", (data) => variantsWritten.push(data));
    expect(variantsWritten).toEqual(["/variants\r"]);
    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(variantsWritten).toEqual(["/variants\r", "\r"]);

    // thinking does not auto-submit
    const thinkingWritten: string[] = [];
    executeAgentCommand("opencode", "/thinking ", (data) => thinkingWritten.push(data));
    expect(thinkingWritten).toEqual(["/thinking "]);

    await new Promise((resolve) => setTimeout(resolve, 70));
    expect(thinkingWritten).toEqual(["/thinking "]);
  });

  it("configures omp with fastMode and plan, models, skills commands", () => {
    const ompProfile = getCliAgentControlProfile("omp");
    expect(ompProfile.fastMode.supported).toBe(true);
    expect(ompProfile.fastMode.command).toBe("/fast\r");
    expect(ompProfile.permissions.map((p) => p.id)).toEqual([
      "plan",
      "models",
      "skills",
    ]);
    expect(ompProfile.permissions.find((p) => p.id === "plan")?.command).toBe("/plan\r");
    expect(ompProfile.permissions.find((p) => p.id === "models")?.command).toBe("/models\r");
    expect(ompProfile.permissions.find((p) => p.id === "skills")?.command).toBe("/skills\r");
  });

  it("refocuses terminal on fast mode toggle and permission selection", () => {
    expect(source).toContain("onFocusTerminal?: () => void;");
    expect(source).toContain("refocusTerminal();");
    expect(source).toContain("onCloseAutoFocus");
  });
});

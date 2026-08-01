import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildPromptEngineerFallback,
  formatPromptEngineerDispatchMessage,
  isCompletePromptBrief,
} from "./transport";

const source = readFileSync(resolve(process.cwd(), "src/modules/ai/lib/transport.ts"), "utf8");

describe("Prompt Engineer dispatch transport", () => {
  it("generates and dispatches prompt-first requests outside the tool loop", () => {
    expect(source).toContain('persona?.name === "Prompt Engineer"');
    expect(source).toContain("generatePromptText");
    expect(source).toContain("getActiveTerminalAgents()");
    expect(source).toContain("getActiveTerminalPaneIndex()");
    expect(source).toContain("targetPane");
    expect(source).toContain("dispatchPromptsToTerminals");
    expect(source).toContain("Prompt generated in English and sent to");
  });

  it("uses the Firstmate-style brief contract and validates incomplete drafts", () => {
    const agentSource = readFileSync(
      resolve(process.cwd(), "src/modules/ai/lib/agent.ts"),
      "utf8",
    );

    expect(agentSource).toContain("## Task");
    expect(agentSource).toContain("## Requirements");
    expect(agentSource).toContain("## Constraints");
    expect(agentSource).toContain("## Validation");
    expect(agentSource).toContain("180–320 words");
    expect(agentSource).toContain("maxOutputTokens: PROMPT_ENGINEER_MAX_OUTPUT_TOKENS");
    expect(agentSource).toContain("/no_think");
    expect(agentSource).toContain("temperature: 0");
    expect(agentSource).not.toContain("Incomplete draft:");
    expect(agentSource).toContain('.replace(/^prompt\\s*:\\s*/i, "")');
    expect(agentSource).toContain("isCompletePromptBrief");
    expect(agentSource).toContain(
      'throw new Error("Prompt model returned an empty response.")',
    );
    expect(agentSource).toContain(
      'throw new Error("Prompt model returned an incomplete brief.")',
    );
    expect(agentSource).not.toContain("Build the requested feature:");
  });

  it("sends a compact implementation brief when prompt generation is unavailable", () => {
    const prompt = buildPromptEngineerFallback("thêm chế độ tối cho giao diện");

    expect(prompt).toContain("## Task");
    expect(prompt).toContain("## Requirements");
    expect(prompt).toContain("## Constraints");
    expect(prompt).toContain("## Validation");
    expect(prompt).toContain("thêm chế độ tối cho giao diện");
    expect(prompt).not.toContain("Build the requested feature:");
  });

  it("creates a useful English Snake-game prompt when the model response is empty", () => {
    const prompt = buildPromptEngineerFallback(
      "viết prompt build snake game với html đi",
    );

    expect(prompt).toContain("Build a complete, playable Snake game");
    expect(prompt).toContain("HTML, CSS, and vanilla JavaScript");
    expect(prompt).toContain("Arrow keys and WASD");
    expect(prompt).toContain("score");
    expect(prompt).not.toContain("viết prompt build snake game với html đi");
  });

  it("creates a specific Three.js portfolio brief when the model response is empty", () => {
    const prompt = buildPromptEngineerFallback(
      "viết prompt build web porfolio với threejs đi",
    );

    expect(prompt).toContain("responsive portfolio landing page");
    expect(prompt).toContain("Three.js");
    expect(prompt).toContain("project work");
    expect(prompt).toContain("## Validation");
    expect(prompt).not.toContain("viết prompt build web porfolio với threejs đi");
  });

  it("accepts complete briefs when the model uses common Markdown heading variants", () => {
    const brief = [
      "# Task:",
      "Build a responsive Three.js portfolio landing page.",
      "",
      "# Context:",
      "Showcase creative work through an interactive but readable experience.",
      "",
      "# Requirements:",
      "- Add a hero, selected projects, and a contact call to action.",
      "",
      "# Constraints:",
      "- Reuse the existing codebase patterns and avoid unnecessary packages.",
      "",
      "# Validation:",
      "- Verify the scene, layout, and navigation on desktop and mobile.",
    ].join("\n");

    expect(isCompletePromptBrief(brief)).toBe(true);
  });

  it("rejects the truncated two-section draft shown by the prompt model", () => {
    const truncated = [
      "## Task",
      "Build a responsive Three.js portfolio landing page.",
      "",
      "## Context",
      "Showcase work through a 3D scene and scroll animations.",
    ].join("\n");
    const complete = [
      truncated,
      "",
      "## Requirements",
      "- Build the hero, project work, and interactions.",
      "",
      "## Constraints",
      "- Inspect the existing codebase first.",
      "",
      "## Validation",
      "- Verify desktop and mobile interactions.",
    ].join("\n");

    expect(isCompletePromptBrief(truncated)).toBe(false);
    expect(isCompletePromptBrief(complete)).toBe(true);
  });

  it("reports model and terminal timings after a prompt is dispatched", () => {
    const message = formatPromptEngineerDispatchMessage({
      sent: 1,
      usedFallback: false,
      generationMs: 61_230,
      dispatchMs: 18,
    });

    expect(message).toContain("Prompt generated in English");
    expect(message).toContain("1m 1s");
    expect(message).toContain("AI 1m 1s");
    expect(message).toContain("terminal <1s");
  });

  it("bounds a slow prompt-model request instead of waiting for a repair pass", () => {
    const agentSource = readFileSync(
      resolve(process.cwd(), "src/modules/ai/lib/agent.ts"),
      "utf8",
    );

    expect(agentSource).toContain("PROMPT_GENERATION_TIMEOUT_MS");
    expect(agentSource).toContain("AbortSignal.timeout(PROMPT_GENERATION_TIMEOUT_MS)");
    expect(agentSource).not.toContain("Incomplete draft:");
  });
});

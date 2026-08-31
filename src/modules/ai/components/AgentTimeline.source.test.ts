import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentTimeline.tsx", import.meta.url),
  "utf8",
);

describe("AgentTimeline contract", () => {
  it("owns empty, user, assistant, reasoning and tool timeline rendering", () => {
    expect(source).toContain("export function AgentTimeline");
    expect(source).toContain("Start a {agentName} session");
    expect(source).toContain("AgentUserPrompt");
    expect(source).toContain("AgentAssistantMessage");
    expect(source).toContain("AgentReasoningItem");
    expect(source).toContain("AgentToolTimelineItem");
    expect(source).toContain("onFork");
  });
});

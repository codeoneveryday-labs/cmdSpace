import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./agentChatPromptModel.ts", import.meta.url),
  "utf8",
);

describe("agentChatPromptModel contract", () => {
  it("centralizes draft and attachment prompt composition", () => {
    expect(source).toContain("composeAgentChatPrompt");
    expect(source).toContain("Attached context:");
    expect(source).toContain("Chat history attachment:");
    expect(source).toContain("displayPrompt");
    expect(source).toContain("composedPrompt");
  });
});

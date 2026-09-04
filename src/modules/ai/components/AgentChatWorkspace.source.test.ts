import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const componentPath = path.join(here, "AgentChatWorkspace.tsx");

describe("AgentChatWorkspace", () => {
  it("is a standalone agent-chat composition root and never routes prompts through a terminal", () => {
    expect(existsSync(componentPath)).toBe(true);
    const source = readFileSync(componentPath, "utf8");

    expect(source).toContain("useAgentChatSession");
    expect(source).toContain("<AgentChatHistory");
    expect(source).toContain("<AgentChatComposer");
    expect(source).not.toContain("Sent to");
    expect(source).not.toContain("CmdInteractiveAgentChat");
    expect(source).not.toContain("TerminalPane");
  });

  it("keeps composer and timeline policy in their dedicated hooks and children", () => {
    const source = readFileSync(componentPath, "utf8");

    expect(source).toContain("useAgentChatControls");
    expect(source).toContain("useAgentAttachments");
    expect(source).toContain("useAgentUsagePolling");
    expect(source).toContain("useWhisperRecording");
    expect(source).toContain("ownerKey: `agent-chat:${chatId}`");
    expect(source).toContain("useAgentChatSubmit");
    expect(source).toContain("useAgentEditActions");
  });
});

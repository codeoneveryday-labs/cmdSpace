import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceSetupAgentSelectionSync.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceSetupAgentSelectionSync contract", () => {
  it("keeps fork initialization and selected-agent fallback together", () => {
    expect(source).toContain("useWorkspaceSetupAgentSelectionSync");
    expect(source).toContain("setSetupStep(\"agents\")");
    expect(source).toContain("setAgentCounts({ [forkContext.provider]: 1 })");
    expect(source).toContain("agentChatAgents[0]?.id");
    expect(source).not.toContain("invoke(");
  });
});

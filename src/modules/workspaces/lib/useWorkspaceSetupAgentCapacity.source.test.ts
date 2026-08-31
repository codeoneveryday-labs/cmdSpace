import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceSetupAgentCapacity.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceSetupAgentCapacity contract", () => {
  it("owns terminal capacity clamping and agent-count synchronization", () => {
    expect(source).toContain("useWorkspaceSetupAgentCapacity");
    expect(source).toContain("regularTerminalCount");
    expect(source).toContain("cliTerminalCapacity");
    expect(source).toContain("setAgentCount");
    expect(source).toContain("setSelectedChatAgent");
    expect(source).not.toContain("invoke(");
  });
});

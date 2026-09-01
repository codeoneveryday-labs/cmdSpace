import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./workspaceAgentSessionModel.ts", import.meta.url),
  "utf8",
);

describe("workspaceAgentSessionModel contract", () => {
  it("keeps native-session association as a pure immutable update", () => {
    expect(source).toContain("prepareAgentWorkspaceTerminal");
    expect(source).toContain("appendAgentWorkspaceTerminal");
    expect(source).toContain("updateWorkspaceAgentSessionIdentity");
    expect(source).toContain("agentProviders");
    expect(source).toContain("agentSessionIds");
    expect(source).not.toContain("setWorkspaces");
    expect(source).not.toContain("invoke(");
  });
});

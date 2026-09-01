import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceAgentSessionIdentity.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceAgentSessionIdentity contract", () => {
  it("owns native-session association and persistence through injected ports", () => {
    expect(source).toContain("useWorkspaceAgentSessionIdentity");
    expect(source).toContain("agentSessionIds");
    expect(source).toContain("persistWorkspace(updated)");
    expect(source).not.toContain('invoke("db_save_workspace"');
  });
});

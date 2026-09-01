import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAppAgentSessionIdentity.ts", import.meta.url),
  "utf8",
);

describe("useAppAgentSessionIdentity contract", () => {
  it("updates live tab/workspace identity and persists the descriptor", () => {
    expect(source).toContain("useAppAgentSessionIdentity");
    expect(source).toContain("updateTab(tabId, { nativeSessionId })");
    expect(source).toContain("updateWorkspaceAgentSessionIdentity");
    expect(source).toContain("setWorkspaces");
    expect(source).toContain('invoke("db_save_workspace"');
    expect(source).toContain("Failed to persist agent session identity");
  });
});

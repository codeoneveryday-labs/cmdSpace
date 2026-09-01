import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceForkActions.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceForkActions contract", () => {
  it("keeps fork-to-tab and fork-to-setup behavior behind explicit adapters", () => {
    expect(source).toContain("useWorkspaceForkActions");
    expect(source).toContain("appendForkedAgentTab");
    expect(source).toContain("newAgentChatTab");
    expect(source).toContain('destination === "tab"');
    expect(source).toContain("setWorkspaceForkContext");
    expect(source).toContain("setWorkspaceSetupOpen(true)");
    expect(source).toContain('invoke("db_save_workspace"');
  });
});

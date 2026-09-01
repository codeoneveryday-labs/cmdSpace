import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./workspaceForkModel.ts", import.meta.url), "utf8");

describe("workspaceForkModel contract", () => {
  it("keeps fork metadata updates pure", () => {
    expect(source).toContain("appendForkedAgentTab");
    expect(source).toContain("agentChatIds");
    expect(source).not.toContain("setWorkspaces");
    expect(source).not.toContain("invoke(");
  });
});

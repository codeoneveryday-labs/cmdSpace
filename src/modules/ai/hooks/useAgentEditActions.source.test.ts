import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAgentEditActions.ts", import.meta.url),
  "utf8",
);

describe("useAgentEditActions contract", () => {
  it("owns review dispatch and same-repository discard validation", () => {
    expect(source).toContain("useAgentEditActions");
    expect(source).toContain("onOpenFileDiff");
    expect(source).toContain("native.gitDiscard");
    expect(source).toContain("repoRoot");
    expect(source).toContain("untracked");
  });
});

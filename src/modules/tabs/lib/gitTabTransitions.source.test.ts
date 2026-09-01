import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./gitTabTransitions.ts", import.meta.url), "utf8");

describe("gitTabTransitions contract", () => {
  it("owns git tab identity matching and update policies", () => {
    expect(source).toContain("openGitDiffState");
    expect(source).toContain("openGitHistoryState");
    expect(source).toContain("openGitCommitFileDiffState");
    expect(source).toContain("repoRoot");
    expect(source).toContain("shortSha");
  });
});

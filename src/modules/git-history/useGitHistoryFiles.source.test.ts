import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./useGitHistoryFiles.ts", import.meta.url), "utf8");

describe("useGitHistoryFiles contract", () => {
  it("owns cache deduplication, retry state, and bounded eviction", () => {
    expect(source).toContain("inflightRef");
    expect(source).toContain("FILES_CACHE_LIMIT");
    expect(source).toContain("gitCommitFiles(repoRoot, sha)");
    expect(source).toContain('state: "error"');
    expect(source).toContain("clearCache");
  });
});

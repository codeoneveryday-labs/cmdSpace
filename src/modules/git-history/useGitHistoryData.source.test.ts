import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./useGitHistoryData.ts", import.meta.url), "utf8");

describe("useGitHistoryData contract", () => {
  it("owns guarded initial loading, pagination, and remote cleanup", () => {
    expect(source).toContain("requestIdRef");
    expect(source).toContain("inflightMoreRef");
    expect(source).toContain("beforeSha: last.sha");
    expect(source).toContain("gitRemoteUrl(repoRoot)");
    expect(source).toContain("cancelled = true");
  });
});

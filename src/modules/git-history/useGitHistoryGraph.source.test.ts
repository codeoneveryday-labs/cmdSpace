import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useGitHistoryGraph.ts", import.meta.url),
  "utf8",
);

describe("useGitHistoryGraph contract", () => {
  it("hides incremental graph cache policy behind a small hook", () => {
    expect(source).toContain("updateGitHistoryGraphCache");
    expect(source).toContain("layoutGraph(delta, cache.tail)");
    expect(source).toContain("cache.firstSha === firstSha");
    expect(source).toContain("useGitHistoryGraph");
  });
});

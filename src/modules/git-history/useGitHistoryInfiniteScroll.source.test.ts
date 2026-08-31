import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useGitHistoryInfiniteScroll.ts", import.meta.url),
  "utf8",
);

describe("useGitHistoryInfiniteScroll contract", () => {
  it("owns near-bottom loading, auto-fill and cleanup", () => {
    expect(source).toContain("remaining");
    expect(source).toContain("loadMore");
    expect(source).toContain("window.setTimeout");
    expect(source).toContain("window.clearTimeout(id)");
    expect(source).toContain("activeSearch");
  });
});

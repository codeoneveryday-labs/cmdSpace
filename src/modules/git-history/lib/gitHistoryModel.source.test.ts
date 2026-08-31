import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./gitHistoryModel.ts", import.meta.url), "utf8");

describe("gitHistoryModel contract", () => {
  it("keeps search and pagination policy pure", () => {
    expect(source).toContain("filterGitCommits");
    expect(source).toContain("mergeGitCommits");
    expect(source).not.toContain("native.");
    expect(source).not.toContain("useState");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./GitCommitRow.tsx", import.meta.url), "utf8");

describe("GitCommitRow contract", () => {
  it("owns commit row presentation and graph rendering", () => {
    expect(source).toContain("export const GitCommitRow");
    expect(source).toContain("<GraphRail");
    expect(source).toContain("highlight(commit.subject, query)");
    expect(source).toContain("commit.insertions");
  });
});

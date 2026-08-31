import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./GitCommitDetail.tsx", import.meta.url), "utf8");

describe("GitCommitDetail contract", () => {
  it("owns commit metadata actions while delegating file review", () => {
    expect(source).toContain("export function GitCommitDetail");
    expect(source).toContain("Copy SHA");
    expect(source).toContain("commitWebUrl");
    expect(source).toContain("<GitCommitFiles");
    expect(source).toContain("onRetryFiles");
  });
});

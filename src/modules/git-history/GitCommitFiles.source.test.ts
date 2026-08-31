import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./GitCommitFiles.tsx", import.meta.url), "utf8");

describe("GitCommitFiles contract", () => {
  it("owns file-change states and review row interactions", () => {
    expect(source).toContain("export function GitCommitFiles");
    expect(source).toContain("Loading files");
    expect(source).toContain("No file changes.");
    expect(source).toContain("onOpenFile(commit, file)");
    expect(source).toContain("statusTone(file.status)");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./SourceControlCommitComposer.tsx", import.meta.url),
  "utf8",
);

describe("SourceControlCommitComposer contract", () => {
  it("owns commit shortcut, staged status and push/commit feedback", () => {
    expect(source).toContain("export function SourceControlCommitComposer");
    expect(source).toContain("Commit message");
    expect(source).toContain("⌘↩");
    expect(source).toContain("Nothing staged");
    expect(source).toContain("Committing…");
    expect(source).toContain("Pushing…");
    expect(source).toContain("CommitFeedback");
  });
});

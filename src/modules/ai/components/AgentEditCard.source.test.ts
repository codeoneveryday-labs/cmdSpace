import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentEditCard.tsx", import.meta.url),
  "utf8",
);

describe("AgentEditCard contract", () => {
  it("shows changed files with review and undo actions", () => {
    expect(source).toContain("export function AgentEditCard");
    expect(source).toContain("Edited {files.length}");
    expect(source).toContain("Review");
    expect(source).toContain("Undo");
    expect(source).toContain("file.path");
  });
});

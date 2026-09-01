import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./aiDiffTransitions.ts", import.meta.url), "utf8");

describe("aiDiffTransitions contract", () => {
  it("owns final-diff approval and active fallback policy", () => {
    expect(source).toContain("closeAiDiffState");
    expect(source).toContain('status: "approved"');
    expect(source).toContain("nextTabs");
    expect(source).toContain("activeId");
  });
});

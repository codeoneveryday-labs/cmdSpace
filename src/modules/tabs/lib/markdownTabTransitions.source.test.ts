import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./markdownTabTransitions.ts", import.meta.url), "utf8");

describe("markdownTabTransitions contract", () => {
  it("owns markdown path dedupe and creation", () => {
    expect(source).toContain("openMarkdownTabState");
    expect(source).toContain("kind === \"markdown\"");
    expect(source).toContain("createMarkdownTab");
    expect(source).toContain("targetId");
  });
});

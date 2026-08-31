import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAgentChatScroll.ts", import.meta.url),
  "utf8",
);

describe("useAgentChatScroll contract", () => {
  it("owns near-bottom tracking, active outline updates and auto-scroll", () => {
    expect(source).toContain("useAgentChatScroll");
    expect(source).toContain("setNearBottom");
    expect(source).toContain("setActiveHistoryIndex");
    expect(source).toContain("scrollToLatest");
    expect(source).toContain("scrollDependency");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentReasoningItem.tsx", import.meta.url),
  "utf8",
);

describe("AgentReasoningItem contract", () => {
  it("renders collapsible reasoning text", () => {
    expect(source).toContain("export function AgentReasoningItem");
    expect(source).toContain("<details");
    expect(source).toContain("Reasoning");
    expect(source).toContain("item.text");
  });
});

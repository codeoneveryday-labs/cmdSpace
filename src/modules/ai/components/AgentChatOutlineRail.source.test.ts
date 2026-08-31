import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./AgentChatOutlineRail.tsx", import.meta.url),
  "utf8",
);

describe("AgentChatOutlineRail contract", () => {
  it("renders prompt navigation with hover focus state", () => {
    expect(source).toContain("export function AgentChatOutlineRail");
    expect(source).toContain("Chat outline");
    expect(source).toContain("onJump(prompt.id)");
    expect(source).toContain("setHoveredIndex");
    expect(source).toContain("slotHeight");
  });
});

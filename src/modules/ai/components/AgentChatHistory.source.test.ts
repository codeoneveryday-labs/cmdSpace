import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "AgentChatHistory.tsx",
);

describe("AgentChatHistory", () => {
  it("owns history scrolling and keeps the edit review card at the timeline end", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("useAgentChatScroll");
    expect(source).toContain("AgentChatOutlineRail");
    expect(source).toContain("AgentTimeline");
    expect(source).toContain("AgentEditCard");
    expect(source).toContain("onReview={onReviewEdits}");
    expect(source).toContain("onUndo={onUndoEdits}");
    expect(source).toContain("Scroll to latest message");
  });
});

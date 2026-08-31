import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAgentChatSubmit.ts", import.meta.url),
  "utf8",
);

describe("useAgentChatSubmit contract", () => {
  it("coordinates prompt composition, baseline capture and submit/steer cleanup", () => {
    expect(source).toContain("useAgentChatSubmit");
    expect(source).toContain("gitPanelSnapshot");
    expect(source).toContain("beginEditTracking");
    expect(source).toContain("timelineStatus === \"running\" ? steer : submit");
    expect(source).toContain("clearAttachments");
    expect(source).toContain("setHistoryAttachments([])");
  });
});

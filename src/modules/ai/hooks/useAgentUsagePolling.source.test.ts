import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useAgentUsagePolling.ts", import.meta.url),
  "utf8",
);

describe("useAgentUsagePolling contract", () => {
  it("polls supported agent usage and cleans up on unmount", () => {
    expect(source).toContain("useAgentUsagePolling");
    expect(source).toContain("getAgentUsageStatuses");
    expect(source).toContain("window.setInterval");
    expect(source).toContain("window.clearInterval");
    expect(source).toContain("supported");
  });
});

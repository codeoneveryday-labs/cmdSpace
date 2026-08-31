import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./TerminalAgentUsage.tsx", import.meta.url), "utf8");

describe("TerminalAgentUsage contract", () => {
  it("owns optional usage polling and presentation", () => {
    expect(source).toContain("useTerminalAgentUsage");
    expect(source).toContain("getAgentUsageStatuses");
    expect(source).toContain("AgentUsageMenu");
    expect(source).toContain("window.clearInterval");
  });
});

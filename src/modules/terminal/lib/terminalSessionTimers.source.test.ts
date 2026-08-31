import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalSessionTimers.ts", import.meta.url),
  "utf8",
);

describe("terminalSessionTimers contract", () => {
  it("centralizes cleanup for every session activity timer", () => {
    expect(source).toContain("clearTerminalSessionTimers");
    expect(source).toContain("initialCommandFallbackTimer");
    expect(source).toContain("agentActivityTimer");
    expect(source).toContain("outputActivityTimer");
  });
});

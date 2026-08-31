import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalSessionCommandLifecycle.ts", import.meta.url),
  "utf8",
);

describe("terminalSessionCommandLifecycle contract", () => {
  it("owns initial command flush and bounded fallback scheduling", () => {
    expect(source).toContain("flushInitialCommand");
    expect(source).toContain("scheduleInitialCommandFallback");
    expect(source).toContain("initialCommandFallbackTimer");
    expect(source).toContain('window.setTimeout');
    expect(source).toContain('command + "\\r"');
    expect(source).toContain("setAgentCliCommand");
  });
});

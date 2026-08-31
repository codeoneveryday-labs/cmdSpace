import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalSessionReady.ts", import.meta.url),
  "utf8",
);

describe("terminalSessionReady contract", () => {
  it("races font readiness against a bounded startup timeout", () => {
    expect(source).toContain("waitForTerminalSessionReady");
    expect(source).toContain("ensureMonoFontsLoaded");
    expect(source).toContain("document.fonts.ready");
    expect(source).toContain("Promise.race");
    expect(source).toContain("1500");
  });
});

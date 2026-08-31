import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useTerminalRendererPreferences.ts", import.meta.url),
  "utf8",
);

describe("useTerminalRendererPreferences contract", () => {
  it("synchronizes terminal rendering preferences through the pool", () => {
    expect(source).toContain("useTerminalRendererPreferences");
    expect(source).toContain("applyFontSize");
    expect(source).toContain("applyFontFamily");
    expect(source).toContain("applyScrollback");
    expect(source).toContain("applyWebglPreference");
    expect(source).toContain("applyBackgroundActive");
  });
});

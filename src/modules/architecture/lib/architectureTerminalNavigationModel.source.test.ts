import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./architectureTerminalNavigationModel.ts", import.meta.url),
  "utf8",
);

describe("architectureTerminalNavigationModel contract", () => {
  it("keeps directional terminal selection as a pure policy", () => {
    expect(source).toContain("findNearestTerminalInDirection");
    expect(source).toContain('direction === "left"');
    expect(source).toContain('direction === "right"');
    expect(source).toContain('direction === "up"');
    expect(source).toContain('direction === "down"');
  });
});

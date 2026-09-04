import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./architectureDiagramNormalization.ts", import.meta.url),
  "utf8",
);

describe("architectureDiagramNormalization contract", () => {
  it("owns persisted diagram validation and legacy terminal migration", () => {
    expect(source).toContain("normalizeDiagramSeed");
    expect(source).toContain("needsTerminalSizeMigration");
    expect(source).toContain("nodeIds");
    expect(source).toContain("edgeIds");
    expect(source).toContain("normalizeTerminalDockGroups");
    expect(source).toContain('kind === "browser"');
  });
});

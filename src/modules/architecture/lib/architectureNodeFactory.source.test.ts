import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./architectureNodeFactory.ts", import.meta.url),
  "utf8",
);

describe("architectureNodeFactory contract", () => {
  it("centralizes shape, surface and terminal node construction", () => {
    expect(source).toContain("createCanvasNode");
    expect(source).toContain("createSurfaceNode");
    expect(source).toContain("terminalChromeVersion");
    expect(source).toContain("initialCommand");
    expect(source).toContain("defaultTechnology");
  });
});

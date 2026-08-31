import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./canvasDockingModel.ts", import.meta.url),
  "utf8",
);

describe("canvasDockingModel contract", () => {
  it("centralizes collision obstacle derivation for live surfaces", () => {
    expect(source).toContain("buildTerminalPlacementObstacles");
    expect(source).toContain("dockedTerminalIds");
    expect(source).toContain("terminalDockGroups");
    expect(source).toContain('node.kind !== "terminal"');
    expect(source).toContain("resolveCanvasDockTarget");
    expect(source).toContain("projectTerminalDockLayouts");
    expect(source).toContain("resolveTerminalDockDrop");
  });
});

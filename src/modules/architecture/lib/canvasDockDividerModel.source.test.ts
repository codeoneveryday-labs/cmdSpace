import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./canvasDockDividerModel.ts", import.meta.url),
  "utf8",
);

describe("canvasDockDividerModel contract", () => {
  it("centralizes divider ratio and keyboard delta policy", () => {
    expect(source).toContain("clampDockDividerRatio");
    expect(source).toContain("dockDividerKeyboardDelta");
    expect(source).toContain("ArrowLeft");
    expect(source).toContain("ArrowDown");
  });
});

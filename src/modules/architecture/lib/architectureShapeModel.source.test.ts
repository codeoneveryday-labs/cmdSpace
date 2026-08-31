import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./architectureShapeModel.ts", import.meta.url),
  "utf8",
);

describe("architectureShapeModel contract", () => {
  it("centralizes shape defaults and geometry normalization", () => {
    expect(source).toContain("defaultSize");
    expect(source).toContain("minimumDrawingSize");
    expect(source).toContain("normalizeDragRect");
    expect(source).toContain("normalizeResizeRect");
    expect(source).toContain("updateResizedNode");
    expect(source).toContain("updateRotatingNode");
    expect(source).toContain("TERMINAL_DEFAULT_SIZE");
  });
});

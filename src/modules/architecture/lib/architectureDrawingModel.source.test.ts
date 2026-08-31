import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./architectureDrawingModel.ts", import.meta.url),
  "utf8",
);

describe("architectureDrawingModel contract", () => {
  it("centralizes pen, connector and shape drawing transitions", () => {
    expect(source).toContain("updateDrawingNode");
    expect(source).toContain('drawing.kind === "pen"');
    expect(source).toContain('drawing.kind === "line"');
    expect(source).toContain("snapConnectorEndpoint");
    expect(source).toContain("resizeShapeNode");
  });
});

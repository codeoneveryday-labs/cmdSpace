import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "useCanvasShapeGestures.ts",
  ),
  "utf8",
);

describe("useCanvasShapeGestures contract", () => {
  it("owns shape gesture state and delegates pointer updates to model transitions", () => {
    expect(source).toContain("const [drawing, setDrawing]");
    expect(source).toContain("const [resize, setResize]");
    expect(source).toContain("const [rotate, setRotate]");
    expect(source).toContain("const [connectorHandle, setConnectorHandle]");
    expect(source).toContain("updateDrawingNode");
    expect(source).toContain("updateResizedNode");
    expect(source).toContain("updateConnectorHandle");
  });
});

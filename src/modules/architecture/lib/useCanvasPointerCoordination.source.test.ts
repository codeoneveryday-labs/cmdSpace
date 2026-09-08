import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Canvas pointer coordination seam", () => {
  it("owns canvas pointer down/move/end handler composition", () => {
    const source = readFileSync(
      new URL("./useCanvasPointerCoordination.ts", import.meta.url),
      "utf8",
    );
    const canvas = readFileSync(
      new URL("../ArchitectureCanvas.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("useCanvasPointerMove");
    expect(source).toContain("useCanvasPointerEnd");
    expect(source).toContain("useCanvasPointerDown");
    expect(canvas).toContain("useCanvasPointerCoordination");
    expect(canvas).toContain("pointerCoordination.pointerMove");
    expect(canvas).toContain("pointerCoordination.pointerEnd");
    expect(canvas).toContain("pointerCoordination.canvasPointerDown");
  });
});

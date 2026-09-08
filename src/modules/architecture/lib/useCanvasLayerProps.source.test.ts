import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Canvas layer props seam", () => {
  it("keeps viewport layer contracts typed outside the canvas coordinator", () => {
    const source = readFileSync(
      new URL("./useCanvasLayerProps.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("CanvasBackgroundMedia");
    expect(source).toContain("CanvasDiagramSvg");
    expect(source).toContain("CanvasTerminalLayer");
    expect(source).toContain("CanvasInteractionOverlays");
    expect(source).toContain("backgroundImageId:");
    expect(source).toContain("diagram:");
    expect(source).toContain("terminalLayer:");
    expect(source).toContain("overlays:");
  });
});

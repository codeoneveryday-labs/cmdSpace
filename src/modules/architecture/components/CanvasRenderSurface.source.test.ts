import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Canvas render surface", () => {
  it("keeps diagram, terminal, and overlay rendering behind a presentational seam", () => {
    const source = readFileSync(
      new URL("./CanvasRenderSurface.tsx", import.meta.url),
      "utf8",
    );
    const canvas = readFileSync(
      new URL("../ArchitectureCanvas.tsx", import.meta.url),
      "utf8",
    );

    expect(source).toContain("CanvasBackgroundMedia");
    expect(source).toContain("CanvasDiagramSvg");
    expect(source).toContain("CanvasTerminalLayer");
    expect(source).toContain("CanvasInteractionOverlays");
    expect(source).toContain("diagram");
    expect(source).toContain("terminalLayer");
    expect(source).toContain("overlays");
    expect(canvas).toContain("<CanvasRenderSurface");
    expect(canvas).not.toContain("<CanvasViewport");
  });
});

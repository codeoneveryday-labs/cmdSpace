import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "CanvasViewport.tsx",
);

describe("CanvasViewport", () => {
  it("preserves the compatibility facade without owning layer composition", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("CanvasRenderSurface");
    expect(source).toContain("CanvasLayerProps");
    expect(source).not.toContain("CanvasDiagramSvg");
    expect(source).not.toContain("CanvasTerminalLayer");
    expect(source).not.toContain("CanvasInteractionOverlays");
    expect(source).not.toContain("invoke(");
    expect(source).not.toContain("useState(");
    expect(source).not.toContain("useEffect(");
  });
});

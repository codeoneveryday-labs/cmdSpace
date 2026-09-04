import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourcePath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "CanvasViewport.tsx",
);

describe("CanvasViewport", () => {
  it("composes canvas surfaces without owning IPC or persistence", () => {
    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("CanvasDiagramSvg");
    expect(source).toContain("CanvasTerminalLayer");
    expect(source).toContain("CanvasInteractionOverlays");
    expect(source).not.toContain("invoke(");
    expect(source).not.toContain("useState(");
    expect(source).not.toContain("useEffect(");
  });
});

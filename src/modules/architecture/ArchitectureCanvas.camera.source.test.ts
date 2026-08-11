import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(new URL(import.meta.url).pathname);
const source = readFileSync(path.join(here, "ArchitectureCanvas.tsx"), "utf8");

describe("ArchitectureCanvas camera seam", () => {
  it("delegates camera state and pointer math to the extracted camera hook", () => {
    expect(source).toContain(
      'import { useCanvasCamera } from "./lib/useCanvasCamera";',
    );
    expect(source).toContain("const camera = useCanvasCamera({");
    expect(source).toContain("camera.startPan(event);");
    expect(source).toContain("camera.handleWheel(");
    expect(source).toContain("camera.svgPointFromClient(event)");
  });

  it("keeps camera implementation details out of the canvas coordinator", () => {
    expect(source).not.toContain("const [pan, setPan]");
    expect(source).not.toContain("const [view, setView]");
    expect(source).not.toContain("const [canvasSize, setCanvasSize]");
    expect(source).not.toContain("function centeredView(");
    expect(source).not.toContain("function clampView(");
    expect(source).not.toContain("function clampViewCoord(");
    expect(source).not.toContain("function canvasPanMargin(");
    expect(source).not.toContain("function wheelPanDelta(");
  });
});

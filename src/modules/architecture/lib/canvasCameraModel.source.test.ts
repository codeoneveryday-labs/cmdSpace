import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./canvasCameraModel.ts", import.meta.url),
  "utf8",
);

describe("canvasCameraModel contract", () => {
  it("keeps camera coordinate and zoom math independent of React state", () => {
    expect(source).toContain("canvasPointFromClient");
    expect(source).toContain("zoomCanvasViewAtPoint");
    expect(source).toContain("centerCanvasView");
    expect(source).toContain("clampCanvasView");
    expect(source).toContain("wheelPanDelta");
    expect(source).not.toContain("useState");
    expect(source).not.toContain("useEffect");
  });
});

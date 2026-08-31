import { describe, expect, it } from "vitest";
import { resolveCanvasDockTarget } from "./canvasDockingModel";

describe("canvasDockingModel target projection", () => {
  it("returns no target when projected dock layouts are empty", () => {
    expect(
      resolveCanvasDockTarget({
        point: { x: 10, y: 10 },
        terminalLayouts: [],
        draggedTerminalId: "terminal",
        view: { x: 0, y: 0 },
        viewWidth: 100,
        viewHeight: 100,
        svgRect: { x: 0, y: 0, width: 100, height: 100 },
      }),
    ).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { panViewFromPointer } from "./canvasPan";

describe("panViewFromPointer", () => {
  it("uses the fixed screen-space drag delta instead of the moving canvas viewport", () => {
    expect(
      panViewFromPointer(
        { clientX: 200, clientY: 100, viewX: 300, viewY: 240 },
        { clientX: 260, clientY: 160 },
        0.6,
      ),
    ).toEqual({ x: 200, y: 140 });
  });
});

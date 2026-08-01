import { describe, expect, it } from "vitest";

import { terminalWorldTransform } from "./canvasCoordinates";

describe("terminalWorldTransform", () => {
  it("cancels the global app zoom so terminal DOM and SVG share screen coordinates", () => {
    const transform = terminalWorldTransform(
      { x: 100, y: 200, scale: 0.75 },
      1.25,
    );

    expect(transform).toEqual({
      translateX: -60,
      translateY: -120,
      scale: 0.6,
    });
    expect(transform.scale * 1.25).toBeCloseTo(0.75);
  });

  it("falls back to an unzoomed transform for an invalid app zoom", () => {
    expect(terminalWorldTransform({ x: 100, y: 200, scale: 0.75 }, 0)).toEqual({
      translateX: -75,
      translateY: -150,
      scale: 0.75,
    });
  });
});

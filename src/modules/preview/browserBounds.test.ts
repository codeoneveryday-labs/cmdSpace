import { describe, expect, it } from "vitest";
import { intersectBrowserBounds } from "./browserBounds";

describe("intersectBrowserBounds", () => {
  it("keeps bounds that are fully inside the canvas viewport", () => {
    expect(
      intersectBrowserBounds(
        { left: 120, top: 80, width: 400, height: 300 },
        { left: 100, top: 60, width: 900, height: 700 },
      ),
    ).toEqual({ left: 120, top: 80, width: 400, height: 300 });
  });

  it("clips bounds that extend beyond the canvas viewport", () => {
    expect(
      intersectBrowserBounds(
        { left: 40, top: 80, width: 400, height: 300 },
        { left: 100, top: 60, width: 900, height: 700 },
      ),
    ).toEqual({ left: 100, top: 80, width: 340, height: 300 });
  });

  it("returns null when the browser is fully outside the canvas viewport", () => {
    expect(
      intersectBrowserBounds(
        { left: -400, top: 80, width: 200, height: 300 },
        { left: 100, top: 60, width: 900, height: 700 },
      ),
    ).toBeNull();
  });
});

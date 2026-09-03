import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  avoidNativeBrowserBounds,
  clearNativeBrowserBoundsForTests,
  publishNativeBrowserBounds,
  pushRectOutOf,
  readNativeBrowserBounds,
  rectsOverlap,
  subscribeNativeBrowserBounds,
} from "./nativeBrowserBounds";

beforeEach(() => clearNativeBrowserBoundsForTests());

describe("native browser bounds registry", () => {
  it("publishes, reads, and removes rects per browser id", () => {
    publishNativeBrowserBounds("a", { left: 10, top: 10, width: 100, height: 100 });
    publishNativeBrowserBounds("b", { left: 200, top: 10, width: 100, height: 100 });
    expect(readNativeBrowserBounds()).toHaveLength(2);
    publishNativeBrowserBounds("a", null);
    expect(readNativeBrowserBounds()).toEqual([
      { left: 200, top: 10, width: 100, height: 100 },
    ]);
  });

  it("notifies subscribers only on real changes", () => {
    const notify = vi.fn();
    subscribeNativeBrowserBounds(notify);
    publishNativeBrowserBounds("a", { left: 10, top: 10, width: 100, height: 100 });
    publishNativeBrowserBounds("a", { left: 10, top: 10, width: 100, height: 100 });
    publishNativeBrowserBounds("missing", null);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("supports unsubscribe", () => {
    const notify = vi.fn();
    const unsubscribe = subscribeNativeBrowserBounds(notify);
    unsubscribe();
    publishNativeBrowserBounds("a", { left: 10, top: 10, width: 100, height: 100 });
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("rect avoidance geometry", () => {
  it("detects overlap versus touching edges", () => {
    expect(
      rectsOverlap(
        { left: 0, top: 0, width: 100, height: 40 },
        { left: 90, top: 0, width: 200, height: 400 },
      ),
    ).toBe(true);
    expect(
      rectsOverlap(
        { left: 0, top: 0, width: 90, height: 40 },
        { left: 90, top: 0, width: 200, height: 400 },
      ),
    ).toBe(false);
  });

  it("pushes out along the smallest-penetration axis", () => {
    // Pill overlapping the browser's left edge by 10px: cheapest is back left.
    expect(
      pushRectOutOf(
        { left: 90, top: 100, width: 120, height: 40 },
        { left: 100, top: 0, width: 300, height: 600 },
      ),
    ).toEqual({ left: -20, top: 100 });
  });

  it("resolves a desired position against several browser rects", () => {
    const resolved = avoidNativeBrowserBounds(
      { left: 90, top: 100 },
      { width: 120, height: 40 },
      [
        { left: 100, top: 0, width: 200, height: 600 },
        { left: 400, top: 0, width: 200, height: 600 },
      ],
    );
    const pill = { ...resolved, width: 120, height: 40 };
    expect(
      rectsOverlap(pill, { left: 100, top: 0, width: 200, height: 600 }),
    ).toBe(false);
    expect(
      rectsOverlap(pill, { left: 400, top: 0, width: 200, height: 600 }),
    ).toBe(false);
  });

  it("leaves non-overlapping positions untouched", () => {
    expect(
      avoidNativeBrowserBounds({ left: 10, top: 10 }, { width: 120, height: 40 }, [
        { left: 400, top: 0, width: 200, height: 600 },
      ]),
    ).toEqual({ left: 10, top: 10 });
  });
});

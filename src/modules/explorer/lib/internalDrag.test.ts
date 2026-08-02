import { describe, expect, it } from "vitest";
import { hasExceededDragThreshold } from "./internalDrag";

describe("Explorer internal pointer drag", () => {
  it("does not turn an ordinary click into a drag", () => {
    expect(hasExceededDragThreshold({ x: 100, y: 100 }, { x: 103, y: 104 })).toBe(
      false,
    );
  });

  it("starts dragging after the pointer moves beyond the threshold", () => {
    expect(hasExceededDragThreshold({ x: 100, y: 100 }, { x: 106, y: 100 })).toBe(
      true,
    );
  });
});

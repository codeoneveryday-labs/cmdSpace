import { describe, expect, it } from "vitest";
import {
  clampDockDividerRatio,
  dockDividerKeyboardDelta,
} from "./canvasDockDividerModel";

describe("canvasDockDividerModel", () => {
  it("clamps divider ratios to the usable range", () => {
    expect(clampDockDividerRatio(-1)).toBe(0.1);
    expect(clampDockDividerRatio(0.5)).toBe(0.5);
    expect(clampDockDividerRatio(2)).toBe(0.9);
  });

  it("uses larger keyboard steps with Shift and ignores unrelated keys", () => {
    expect(
      dockDividerKeyboardDelta({
        direction: "horizontal",
        key: "ArrowRight",
        shiftKey: false,
      }),
    ).toBe(0.05);
    expect(
      dockDividerKeyboardDelta({
        direction: "vertical",
        key: "ArrowUp",
        shiftKey: true,
      }),
    ).toBe(-0.1);
    expect(
      dockDividerKeyboardDelta({
        direction: "horizontal",
        key: "Enter",
        shiftKey: false,
      }),
    ).toBeNull();
  });
});

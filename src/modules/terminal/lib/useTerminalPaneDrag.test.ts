import { describe, expect, it } from "vitest";

import { paneSwapPreviewOffset } from "./useTerminalPaneDrag";

describe("paneSwapPreviewOffset", () => {
  it("moves the target toward the dragged source along both axes", () => {
    expect(
      paneSwapPreviewOffset(
        { left: 0, top: 0, width: 100, height: 100 },
        { left: 200, top: 200, width: 100, height: 100 },
      ),
    ).toEqual({ x: -10, y: -10 });
  });

  it("keeps aligned panes stationary", () => {
    expect(
      paneSwapPreviewOffset(
        { left: 0, top: 0, width: 100, height: 100 },
        { left: 0, top: 0, width: 100, height: 100 },
      ),
    ).toEqual({ x: 0, y: 0 });
  });
});

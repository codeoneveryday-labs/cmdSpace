import { describe, expect, it } from "vitest";
import { commitPaneLayout, resizeAdjacentPanes } from "./paneResizeModel";

describe("paneResizeModel", () => {
  it("clamps adjacent pane sizes while preserving their total", () => {
    const resized = resizeAdjacentPanes(
      { "pane-1": 50, "pane-2": 50 },
      "pane-1",
      "pane-2",
      60,
      10,
    );

    expect(resized).toEqual({ "pane-1": 90, "pane-2": 10 });
  });

  it("returns no layout when either adjacent panel is missing", () => {
    expect(resizeAdjacentPanes({ "pane-1": 50 }, "pane-1", "pane-2", 5, 10)).toBeUndefined();
  });

  it("normalizes changed sizes and preserves unchanged child references", () => {
    const first = { kind: "leaf", id: 1, size: 50 } as const;
    const second = { kind: "leaf", id: 2 } as const;
    const result = commitPaneLayout([first, second], { "pane-1": 50, "pane-2": 33.3336 });

    expect(result.changed).toBe(true);
    expect(result.children[0]).toBe(first);
    expect(result.children[1]).toMatchObject({ id: 2, size: 33.334 });
  });
});

import { describe, expect, it } from "vitest";

describe("TreeRow interaction behavior", () => {
  it("cancels an active pointer drag and requires a second delete confirmation click", async () => {
    const module = await import("./lib/treeRowInteractions");

    expect(typeof module.beginPointerDrag).toBe("function");
    expect(typeof module.updatePointerDrag).toBe("function");
    expect(typeof module.cancelPointerDrag).toBe("function");
    expect(typeof module.advanceDeleteConfirmation).toBe("function");

    const started = module.beginPointerDrag(0, 7, 100, 100);
    const moved = module.updatePointerDrag(started, 7, 106, 100);
    const canceled = module.cancelPointerDrag(moved.state, 7);

    expect(moved.state?.dragging).toBe(true);
    expect(moved.didStartDragging).toBe(true);
    expect(moved.shouldNotifyMove).toBe(true);
    expect(canceled).toMatchObject({
      state: null,
      shouldCancel: true,
    });

    expect(module.advanceDeleteConfirmation(false)).toEqual({
      isConfirming: true,
      shouldDelete: false,
    });
    expect(module.advanceDeleteConfirmation(true)).toEqual({
      isConfirming: false,
      shouldDelete: true,
    });
  });
});

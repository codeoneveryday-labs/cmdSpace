import { describe, expect, it } from "vitest";
import { selectRendererSlot } from "./rendererSlotModel";

describe("rendererSlotModel", () => {
  it("prefers a free slot, then creates below the pool limit", () => {
    expect(selectRendererSlot([
      { currentLeafId: 1, altScreen: false, focused: false, lastUsedAt: 1 },
      { currentLeafId: null, altScreen: false, focused: false, lastUsedAt: 2 },
    ], 2)).toEqual({ type: "free", index: 1 });
    expect(selectRendererSlot([], 2)).toEqual({ type: "create" });
  });

  it("evicts the least-protected slot when full", () => {
    expect(selectRendererSlot([
      { currentLeafId: 1, altScreen: true, focused: false, lastUsedAt: 1 },
      { currentLeafId: 2, altScreen: false, focused: true, lastUsedAt: 2 },
      { currentLeafId: 3, altScreen: false, focused: false, lastUsedAt: 3 },
    ], 3)).toEqual({ type: "evict", index: 2, previousLeafId: 3 });
  });
});

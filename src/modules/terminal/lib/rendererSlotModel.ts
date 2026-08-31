export type RendererSlotCandidate = {
  currentLeafId: number | null;
  altScreen: boolean;
  focused: boolean;
  lastUsedAt: number;
};

export type RendererSlotSelection =
  | { type: "free"; index: number }
  | { type: "create" }
  | { type: "evict"; index: number; previousLeafId: number };

export function selectRendererSlot(
  slots: RendererSlotCandidate[],
  maxSize: number,
): RendererSlotSelection {
  const freeIndex = slots.findIndex((slot) => slot.currentLeafId === null);
  if (freeIndex >= 0) return { type: "free", index: freeIndex };
  if (slots.length < maxSize) return { type: "create" };

  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  slots.forEach((slot, index) => {
    const score =
      (slot.altScreen ? 100 : 0) +
      (slot.focused ? 10 : 0) +
      slot.lastUsedAt / 1e12;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  const previousLeafId = slots[bestIndex]?.currentLeafId;
  if (previousLeafId === null || previousLeafId === undefined) {
    return { type: "free", index: bestIndex };
  }
  return { type: "evict", index: bestIndex, previousLeafId };
}

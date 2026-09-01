import type { Tab } from "./useTabs";

export type TabPlacement = "before" | "after";

export function reorderTabs(
  tabs: readonly Tab[],
  draggedId: number,
  targetId: number,
  placement: TabPlacement = "before",
): Tab[] {
  if (draggedId === targetId) return [...tabs];
  const from = tabs.findIndex((tab) => tab.id === draggedId);
  const targetIndex = tabs.findIndex((tab) => tab.id === targetId);
  if (from < 0 || targetIndex < 0 || from === targetIndex) return [...tabs];
  const next = [...tabs];
  const [dragged] = next.splice(from, 1);
  const adjustedTargetIndex = targetIndex > from ? targetIndex - 1 : targetIndex;
  const insertAt = placement === "after" ? adjustedTargetIndex + 1 : adjustedTargetIndex;
  next.splice(insertAt, 0, dragged);
  return next;
}

export function tabAtIndex(tabs: readonly Tab[], index: number): Tab | null {
  return tabs[index] ?? null;
}

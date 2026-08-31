import type { PaneNode } from "./panes";

export function resizeAdjacentPanes(
  layout: Record<string, number>,
  previousPanelId: string,
  nextPanelId: string,
  deltaPercent: number,
  minimumSize: number,
): Record<string, number> | undefined {
  const previousSize = layout[previousPanelId];
  const nextSize = layout[nextPanelId];
  if (previousSize === undefined || nextSize === undefined) return undefined;

  const adjacentTotal = previousSize + nextSize;
  const minimum = Math.min(minimumSize, adjacentTotal / 2);
  const resizedPrevious = Math.min(
    Math.max(previousSize + deltaPercent, minimum),
    adjacentTotal - minimum,
  );
  return {
    ...layout,
    [previousPanelId]: resizedPrevious,
    [nextPanelId]: adjacentTotal - resizedPrevious,
  };
}

export function commitPaneLayout(
  children: PaneNode[],
  layout: Record<string, number>,
): { children: PaneNode[]; changed: boolean } {
  let changed = false;
  const nextChildren = children.map((child) => {
    const size = layout[`pane-${child.id}`];
    if (size === undefined) return child;
    const normalizedSize = Number(size.toFixed(3));
    if (child.size === normalizedSize) return child;
    changed = true;
    return { ...child, size: normalizedSize };
  });
  return { children: nextChildren, changed };
}

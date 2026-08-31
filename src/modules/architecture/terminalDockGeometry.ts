import type {
  ArchitectureTerminalDockGroup,
  ArchitectureTerminalDockNode,
} from "@/modules/tabs";
import type {
  TerminalDockDividerLayout,
  TerminalDockDropTarget,
  TerminalDockEdge,
  TerminalDockRect,
  TerminalDockStackLayout,
} from "./terminalDockLayout";

export const TERMINAL_DOCK_GROUP_HEADER_HEIGHT = 28;
const TAB_BAR_DROP_HEIGHT = 38;
const EDGE_FRACTION = 0.12;
const EDGE_MAX_PX = 60;

function layoutDockNode(
  groupId: string,
  node: ArchitectureTerminalDockNode,
  rect: TerminalDockRect,
  result: TerminalDockStackLayout[],
  dividers?: TerminalDockDividerLayout[],
) {
  if (node.kind === "tabs") {
    result.push({
      groupId,
      stackId: node.id,
      rect,
      terminalIds: node.terminalIds,
      activeTerminalId: node.activeTerminalId,
    });
    return;
  }

  if (node.direction === "horizontal") {
    const firstWidth = rect.width * node.ratio;
    dividers?.push({
      groupId,
      splitId: node.id,
      direction: node.direction,
      rect,
      ratio: node.ratio,
    });
    layoutDockNode(
      groupId,
      node.first,
      { ...rect, width: firstWidth },
      result,
      dividers,
    );
    layoutDockNode(
      groupId,
      node.second,
      {
        x: rect.x + firstWidth,
        y: rect.y,
        width: rect.width - firstWidth,
        height: rect.height,
      },
      result,
      dividers,
    );
    return;
  }

  const firstHeight = rect.height * node.ratio;
  dividers?.push({
    groupId,
    splitId: node.id,
    direction: node.direction,
    rect,
    ratio: node.ratio,
  });
  layoutDockNode(
    groupId,
    node.first,
    { ...rect, height: firstHeight },
    result,
    dividers,
  );
  layoutDockNode(
    groupId,
    node.second,
    {
      x: rect.x,
      y: rect.y + firstHeight,
      width: rect.width,
      height: rect.height - firstHeight,
    },
    result,
    dividers,
  );
}

function terminalGroupContentRect(
  group: ArchitectureTerminalDockGroup,
): TerminalDockRect {
  const sharedHeaderHeight = terminalDockGroupUsesSharedHeader(group)
    ? TERMINAL_DOCK_GROUP_HEADER_HEIGHT
    : 0;
  return {
    x: group.x,
    y: group.y + sharedHeaderHeight,
    width: group.width,
    height: Math.max(0, group.height - sharedHeaderHeight),
  };
}

export function terminalDockGroupUsesSharedHeader(
  group: ArchitectureTerminalDockGroup,
): boolean {
  return group.root.kind === "split";
}

export function projectMaximizedTerminalDockGroups(
  groups: readonly ArchitectureTerminalDockGroup[],
  maximizedTerminalId: string,
  bounds: TerminalDockRect,
): ArchitectureTerminalDockGroup[] {
  if (!maximizedTerminalId) return [...groups];

  const maximizedGroupId = layoutTerminalDockGroups(groups).find((layout) =>
    layout.terminalIds.includes(maximizedTerminalId),
  )?.groupId;
  const maximizedGroup = groups.find(
    (group) => group.id === maximizedGroupId,
  );
  if (!maximizedGroup) return [];

  return [{ ...maximizedGroup, ...bounds }];
}

export function layoutTerminalDockGroups(
  groups: readonly ArchitectureTerminalDockGroup[],
): TerminalDockStackLayout[] {
  const result: TerminalDockStackLayout[] = [];
  for (const group of groups) {
    layoutDockNode(
      group.id,
      group.root,
      terminalGroupContentRect(group),
      result,
    );
  }
  return result;
}

export function layoutTerminalDockDividers(
  groups: readonly ArchitectureTerminalDockGroup[],
): TerminalDockDividerLayout[] {
  const dividers: TerminalDockDividerLayout[] = [];
  for (const group of groups) {
    layoutDockNode(
      group.id,
      group.root,
      terminalGroupContentRect(group),
      [],
      dividers,
    );
  }
  return dividers;
}

export function terminalDockCornerClassName(
  rect: TerminalDockRect,
  group: TerminalDockRect,
): string {
  const epsilon = 0.01;
  const touchesLeft = Math.abs(rect.x - group.x) < epsilon;
  const touchesTop = Math.abs(rect.y - group.y) < epsilon;
  const touchesRight =
    Math.abs(rect.x + rect.width - (group.x + group.width)) < epsilon;
  const touchesBottom =
    Math.abs(rect.y + rect.height - (group.y + group.height)) < epsilon;

  return [
    touchesTop && touchesLeft ? "rounded-tl-[12px]" : "rounded-tl-none",
    touchesTop && touchesRight ? "rounded-tr-[12px]" : "rounded-tr-none",
    touchesBottom && touchesRight
      ? "rounded-br-[12px]"
      : "rounded-br-none",
    touchesBottom && touchesLeft
      ? "rounded-bl-[12px]"
      : "rounded-bl-none",
  ].join(" ");
}

function pointInsideRect(
  point: { x: number; y: number },
  rect: TerminalDockRect,
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

function resolveDropEdge(
  point: { x: number; y: number },
  rect: TerminalDockRect,
): TerminalDockEdge | "tab" | null {
  const relX = point.x - rect.x;
  const relY = point.y - rect.y;
  if (relY >= 0 && relY < TAB_BAR_DROP_HEIGHT) return "tab";

  const leftEdge = Math.min(rect.width * EDGE_FRACTION, EDGE_MAX_PX);
  const rightEdgeStart = rect.width - leftEdge;
  const topEdge = Math.min(rect.height * EDGE_FRACTION, EDGE_MAX_PX);
  const bottomEdgeStart = rect.height - topEdge;

  if (relY < topEdge && relY < relX && relY < rect.width - relX) {
    return "top";
  }
  if (
    relY > bottomEdgeStart &&
    rect.height - relY < relX &&
    rect.height - relY < rect.width - relX
  ) {
    return "bottom";
  }
  if (relX < leftEdge) return "left";
  if (relX > rightEdgeStart) return "right";
  return null;
}

export function resolveTerminalDockDrop(
  point: { x: number; y: number },
  stacks: readonly TerminalDockStackLayout[],
  sourceTerminalId: string,
): TerminalDockDropTarget | null {
  const candidates = stacks
    .filter(
      (stack) =>
        pointInsideRect(point, stack.rect) &&
        !(
          stack.terminalIds.length === 1 &&
          stack.terminalIds[0] === sourceTerminalId
        ),
    )
    .sort(
      (first, second) =>
        first.rect.width * first.rect.height -
        second.rect.width * second.rect.height,
    );
  const target = candidates[0];
  if (!target) return null;
  const edge = resolveDropEdge(point, target.rect);
  if (!edge) return null;
  if (edge === "tab") {
    return {
      kind: "tab",
      groupId: target.groupId,
      stackId: target.stackId,
    };
  }
  return {
    kind: "split",
    groupId: target.groupId,
    stackId: target.stackId,
    edge,
  };
}

export function projectTerminalDockLayouts(
  layouts: readonly TerminalDockStackLayout[],
  canvasView: TerminalDockRect,
  clientRect: TerminalDockRect,
): TerminalDockStackLayout[] {
  return layouts.map((layout) => ({
    ...layout,
    rect: {
      x:
        clientRect.x +
        ((layout.rect.x - canvasView.x) / canvasView.width) * clientRect.width,
      y:
        clientRect.y +
        ((layout.rect.y - canvasView.y) / canvasView.height) *
          clientRect.height,
      width: (layout.rect.width / canvasView.width) * clientRect.width,
      height: (layout.rect.height / canvasView.height) * clientRect.height,
    },
  }));
}

export function terminalDockIndicatorRect(
  target: TerminalDockDropTarget,
  stacks: readonly TerminalDockStackLayout[],
): TerminalDockRect | null {
  const stack = stacks.find(
    (item) =>
      item.groupId === target.groupId && item.stackId === target.stackId,
  );
  if (!stack) return null;
  if (target.kind === "tab") {
    return {
      ...stack.rect,
      height: Math.min(TAB_BAR_DROP_HEIGHT, stack.rect.height),
    };
  }

  const rect = { ...stack.rect };
  if (target.edge === "top") rect.height /= 2;
  else if (target.edge === "bottom") {
    rect.y += rect.height / 2;
    rect.height /= 2;
  } else if (target.edge === "left") rect.width /= 2;
  else {
    rect.x += rect.width / 2;
    rect.width /= 2;
  }
  return rect;
}

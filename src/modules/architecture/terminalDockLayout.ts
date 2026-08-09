import type {
  ArchitectureDiagramNode,
  ArchitectureTerminalDockGroup,
  ArchitectureTerminalDockNode,
} from "@/modules/tabs";

export type TerminalDockRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TerminalDockStackLayout = {
  groupId: string;
  stackId: string;
  rect: TerminalDockRect;
  terminalIds: string[];
  activeTerminalId: string;
};

export type TerminalDockDividerLayout = {
  groupId: string;
  splitId: string;
  direction: "horizontal" | "vertical";
  rect: TerminalDockRect;
  ratio: number;
};

export type TerminalDockEdge = "top" | "bottom" | "left" | "right";

export type TerminalDockDropTarget =
  | {
      kind: "tab";
      groupId: string;
      stackId: string;
    }
  | {
      kind: "split";
      groupId: string;
      stackId: string;
      edge: TerminalDockEdge;
    };

type TerminalBounds = Pick<
  ArchitectureDiagramNode,
  "id" | "x" | "y" | "width" | "height"
>;

export const TERMINAL_DOCK_GROUP_HEADER_HEIGHT = 28;
const TAB_BAR_DROP_HEIGHT = 38;
const EDGE_FRACTION = 0.12;
const EDGE_MAX_PX = 60;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveNumber(value: unknown): value is number {
  return finiteNumber(value) && value > 0;
}

function uniqueId(preferred: string, usedIds: Set<string>): string {
  if (!usedIds.has(preferred)) {
    usedIds.add(preferred);
    return preferred;
  }
  let suffix = 2;
  while (usedIds.has(`${preferred}-${suffix}`)) suffix += 1;
  const id = `${preferred}-${suffix}`;
  usedIds.add(id);
  return id;
}

function normalizeDockNode(
  value: unknown,
  validTerminalIds: ReadonlySet<string>,
  claimedTerminalIds: Set<string>,
  usedNodeIds: Set<string>,
): ArchitectureTerminalDockNode | null {
  if (!isRecord(value)) return null;

  if (value.kind === "tabs") {
    const terminalIds = Array.isArray(value.terminalIds)
      ? value.terminalIds.filter((terminalId): terminalId is string => {
          if (
            typeof terminalId !== "string" ||
            !validTerminalIds.has(terminalId) ||
            claimedTerminalIds.has(terminalId)
          ) {
            return false;
          }
          claimedTerminalIds.add(terminalId);
          return true;
        })
      : [];
    if (terminalIds.length === 0) return null;
    const preferredId =
      typeof value.id === "string" && value.id
        ? value.id
        : `terminal-stack-${terminalIds[0]}`;
    return {
      id: uniqueId(preferredId, usedNodeIds),
      kind: "tabs",
      terminalIds,
      activeTerminalId:
        typeof value.activeTerminalId === "string" &&
        terminalIds.includes(value.activeTerminalId)
          ? value.activeTerminalId
          : terminalIds[0],
    };
  }

  if (value.kind !== "split") return null;
  const first = normalizeDockNode(
    value.first,
    validTerminalIds,
    claimedTerminalIds,
    usedNodeIds,
  );
  const second = normalizeDockNode(
    value.second,
    validTerminalIds,
    claimedTerminalIds,
    usedNodeIds,
  );
  if (!first) return second;
  if (!second) return first;
  const preferredId =
    typeof value.id === "string" && value.id ? value.id : "terminal-split";
  return {
    id: uniqueId(preferredId, usedNodeIds),
    kind: "split",
    direction:
      value.direction === "vertical" ? "vertical" : "horizontal",
    ratio: finiteNumber(value.ratio)
      ? Math.min(0.9, Math.max(0.1, value.ratio))
      : 0.5,
    first,
    second,
  };
}

function collectSavedTerminalIds(
  value: unknown,
  validTerminalIds: ReadonlySet<string>,
  result: Set<string>,
) {
  if (!isRecord(value)) return;
  if (value.kind === "tabs" && Array.isArray(value.terminalIds)) {
    for (const terminalId of value.terminalIds) {
      if (typeof terminalId === "string" && validTerminalIds.has(terminalId)) {
        result.add(terminalId);
      }
    }
    return;
  }
  if (value.kind === "split") {
    collectSavedTerminalIds(value.first, validTerminalIds, result);
    collectSavedTerminalIds(value.second, validTerminalIds, result);
  }
}

export function normalizeTerminalDockGroups(
  terminalNodes: readonly TerminalBounds[],
  savedGroups: unknown,
): ArchitectureTerminalDockGroup[] {
  const validTerminalIds = new Set(terminalNodes.map((node) => node.id));
  const claimedTerminalIds = new Set<string>();
  const usedGroupIds = new Set<string>();
  const usedNodeIds = new Set<string>();
  const groups: ArchitectureTerminalDockGroup[] = [];

  if (Array.isArray(savedGroups)) {
    const candidates = savedGroups
      .map((value, index) => {
        const terminalIds = new Set<string>();
        if (isRecord(value)) {
          collectSavedTerminalIds(value.root, validTerminalIds, terminalIds);
        }
        return { index, value, terminalIds };
      })
      .filter(({ value }) => isRecord(value));
    const membershipCounts = new Map<string, number>();
    for (const candidate of candidates) {
      for (const terminalId of candidate.terminalIds) {
        membershipCounts.set(
          terminalId,
          (membershipCounts.get(terminalId) ?? 0) + 1,
        );
      }
    }
    const hasDuplicateMembership = [...membershipCounts.values()].some(
      (count) => count > 1,
    );
    const orderedCandidates = hasDuplicateMembership
      ? [...candidates].sort((first, second) => {
          const firstHasDuplicate = [...first.terminalIds].some(
            (id) => (membershipCounts.get(id) ?? 0) > 1,
          );
          const secondHasDuplicate = [...second.terminalIds].some(
            (id) => (membershipCounts.get(id) ?? 0) > 1,
          );
          if (firstHasDuplicate !== secondHasDuplicate) {
            return firstHasDuplicate ? -1 : 1;
          }
          if (
            firstHasDuplicate &&
            first.terminalIds.size !== second.terminalIds.size
          ) {
            return second.terminalIds.size - first.terminalIds.size;
          }
          return first.index - second.index;
        })
      : candidates;

    for (const { value } of orderedCandidates) {
      if (
        !finiteNumber(value.x) ||
        !finiteNumber(value.y) ||
        !positiveNumber(value.width) ||
        !positiveNumber(value.height)
      ) {
        continue;
      }
      const root = normalizeDockNode(
        value.root,
        validTerminalIds,
        claimedTerminalIds,
        usedNodeIds,
      );
      if (!root) continue;
      const preferredId =
        typeof value.id === "string" && value.id
          ? value.id
          : `terminal-group-${groups.length + 1}`;
      groups.push({
        id: uniqueId(preferredId, usedGroupIds),
        x: value.x,
        y: value.y,
        width: value.width,
        height: value.height,
        root,
      });
    }
  }

  for (const terminalNode of terminalNodes) {
    if (claimedTerminalIds.has(terminalNode.id)) continue;
    claimedTerminalIds.add(terminalNode.id);
    groups.push({
      id: uniqueId(`terminal-group-${terminalNode.id}`, usedGroupIds),
      x: terminalNode.x,
      y: terminalNode.y,
      width: terminalNode.width,
      height: terminalNode.height,
      root: {
        id: uniqueId(`terminal-stack-${terminalNode.id}`, usedNodeIds),
        kind: "tabs",
        terminalIds: [terminalNode.id],
        activeTerminalId: terminalNode.id,
      },
    });
  }

  return groups;
}

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

function terminalIdsInNode(
  node: ArchitectureTerminalDockNode,
): string[] {
  return node.kind === "tabs"
    ? node.terminalIds
    : [...terminalIdsInNode(node.first), ...terminalIdsInNode(node.second)];
}

function removeTerminalFromNode(
  node: ArchitectureTerminalDockNode,
  terminalId: string,
): ArchitectureTerminalDockNode | null {
  if (node.kind === "tabs") {
    if (!node.terminalIds.includes(terminalId)) return node;
    const terminalIds = node.terminalIds.filter((id) => id !== terminalId);
    if (terminalIds.length === 0) return null;
    return {
      ...node,
      terminalIds,
      activeTerminalId:
        node.activeTerminalId === terminalId
          ? terminalIds[0]
          : node.activeTerminalId,
    };
  }

  const first = removeTerminalFromNode(node.first, terminalId);
  const second = removeTerminalFromNode(node.second, terminalId);
  if (!first) return second;
  if (!second) return first;
  if (first === node.first && second === node.second) return node;
  return { ...node, first, second };
}

function replaceStack(
  node: ArchitectureTerminalDockNode,
  stackId: string,
  replace: (
    stack: Extract<ArchitectureTerminalDockNode, { kind: "tabs" }>,
  ) => ArchitectureTerminalDockNode,
): ArchitectureTerminalDockNode {
  if (node.kind === "tabs") {
    return node.id === stackId ? replace(node) : node;
  }
  const first = replaceStack(node.first, stackId, replace);
  const second = replaceStack(node.second, stackId, replace);
  return first === node.first && second === node.second
    ? node
    : { ...node, first, second };
}

function collectDockNodeIds(
  node: ArchitectureTerminalDockNode,
  result: Set<string>,
) {
  result.add(node.id);
  if (node.kind === "split") {
    collectDockNodeIds(node.first, result);
    collectDockNodeIds(node.second, result);
  }
}

function dockIds(
  groups: readonly ArchitectureTerminalDockGroup[],
): { groupIds: Set<string>; nodeIds: Set<string> } {
  const groupIds = new Set<string>();
  const nodeIds = new Set<string>();
  for (const group of groups) {
    groupIds.add(group.id);
    collectDockNodeIds(group.root, nodeIds);
  }
  return { groupIds, nodeIds };
}

export function removeTerminalFromDock(
  groups: readonly ArchitectureTerminalDockGroup[],
  terminalId: string,
): ArchitectureTerminalDockGroup[] {
  const result: ArchitectureTerminalDockGroup[] = [];
  for (const group of groups) {
    const root = removeTerminalFromNode(group.root, terminalId);
    if (!root) continue;
    result.push(root === group.root ? group : { ...group, root });
  }
  return result;
}

export function dockTerminal(
  groups: readonly ArchitectureTerminalDockGroup[],
  sourceTerminalId: string,
  target: TerminalDockDropTarget,
): ArchitectureTerminalDockGroup[] {
  const sourceStack = layoutTerminalDockGroups(groups).find((stack) =>
    stack.terminalIds.includes(sourceTerminalId),
  );
  if (!sourceStack) return [...groups];
  if (
    sourceStack.stackId === target.stackId &&
    sourceStack.terminalIds.length === 1
  ) {
    return [...groups];
  }

  const withoutSource = removeTerminalFromDock(groups, sourceTerminalId);
  const targetGroup = withoutSource.find((group) => group.id === target.groupId);
  const targetStack = targetGroup
    ? layoutTerminalDockGroups([targetGroup]).find(
        (stack) => stack.stackId === target.stackId,
      )
    : null;
  if (!targetGroup || !targetStack) return [...groups];

  const { nodeIds } = dockIds(withoutSource);
  const sourceTabs: ArchitectureTerminalDockNode = {
    id: uniqueId(`terminal-stack-${sourceTerminalId}`, nodeIds),
    kind: "tabs",
    terminalIds: [sourceTerminalId],
    activeTerminalId: sourceTerminalId,
  };
  const nextRoot = replaceStack(
    targetGroup.root,
    target.stackId,
    (stackNode) => {
      if (target.kind === "tab") {
        return {
          ...stackNode,
          terminalIds: [
            ...stackNode.terminalIds.filter((id) => id !== sourceTerminalId),
            sourceTerminalId,
          ],
          activeTerminalId: sourceTerminalId,
        };
      }
      const sourceFirst = target.edge === "left" || target.edge === "top";
      return {
        id: uniqueId(`terminal-split-${sourceTerminalId}`, nodeIds),
        kind: "split",
        direction:
          target.edge === "left" || target.edge === "right"
            ? "horizontal"
            : "vertical",
        ratio: 0.5,
        first: sourceFirst ? sourceTabs : stackNode,
        second: sourceFirst ? stackNode : sourceTabs,
      };
    },
  );

  return withoutSource.map((group) =>
    group.id === targetGroup.id ? { ...group, root: nextRoot } : group,
  );
}

export function detachTerminal(
  groups: readonly ArchitectureTerminalDockGroup[],
  terminalId: string,
  bounds: TerminalDockRect,
): ArchitectureTerminalDockGroup[] {
  const sourceGroup = groups.find((group) =>
    terminalIdsInNode(group.root).includes(terminalId),
  );
  if (!sourceGroup) return [...groups];
  if (
    sourceGroup.root.kind === "tabs" &&
    sourceGroup.root.terminalIds.length === 1
  ) {
    return updateTerminalGroupBounds(groups, sourceGroup.id, bounds);
  }

  const withoutSource = removeTerminalFromDock(groups, terminalId);
  const { groupIds, nodeIds } = dockIds(withoutSource);
  return [
    ...withoutSource,
    {
      id: uniqueId(`terminal-group-${terminalId}`, groupIds),
      ...bounds,
      root: {
        id: uniqueId(`terminal-stack-${terminalId}`, nodeIds),
        kind: "tabs",
        terminalIds: [terminalId],
        activeTerminalId: terminalId,
      },
    },
  ];
}

function activateTerminalInNode(
  node: ArchitectureTerminalDockNode,
  stackId: string,
  terminalId: string,
): ArchitectureTerminalDockNode {
  if (node.kind === "tabs") {
    if (
      node.id !== stackId ||
      node.activeTerminalId === terminalId ||
      !node.terminalIds.includes(terminalId)
    ) {
      return node;
    }
    return { ...node, activeTerminalId: terminalId };
  }
  const first = activateTerminalInNode(node.first, stackId, terminalId);
  const second = activateTerminalInNode(node.second, stackId, terminalId);
  return first === node.first && second === node.second
    ? node
    : { ...node, first, second };
}

export function activateTerminalTab(
  groups: readonly ArchitectureTerminalDockGroup[],
  stackId: string,
  terminalId: string,
): ArchitectureTerminalDockGroup[] {
  return groups.map((group) => {
    const root = activateTerminalInNode(group.root, stackId, terminalId);
    return root === group.root ? group : { ...group, root };
  });
}

export function updateTerminalGroupBounds(
  groups: readonly ArchitectureTerminalDockGroup[],
  groupId: string,
  bounds: TerminalDockRect,
): ArchitectureTerminalDockGroup[] {
  return groups.map((group) =>
    group.id === groupId ? { ...group, ...bounds } : group,
  );
}

function updateDockSplitRatio(
  node: ArchitectureTerminalDockNode,
  splitId: string,
  ratio: number,
): ArchitectureTerminalDockNode {
  if (node.kind === "tabs") return node;
  if (node.id === splitId) {
    const nextRatio = Math.min(0.9, Math.max(0.1, ratio));
    return node.ratio === nextRatio ? node : { ...node, ratio: nextRatio };
  }
  const first = updateDockSplitRatio(node.first, splitId, ratio);
  const second = updateDockSplitRatio(node.second, splitId, ratio);
  return first === node.first && second === node.second
    ? node
    : { ...node, first, second };
}

export function updateTerminalDockSplitRatio(
  groups: readonly ArchitectureTerminalDockGroup[],
  groupId: string,
  splitId: string,
  ratio: number,
): ArchitectureTerminalDockGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) return group;
    const root = updateDockSplitRatio(group.root, splitId, ratio);
    return root === group.root ? group : { ...group, root };
  });
}

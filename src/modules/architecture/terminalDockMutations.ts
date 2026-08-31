import type {
  ArchitectureTerminalDockGroup,
  ArchitectureTerminalDockNode,
} from "@/modules/tabs";
import { layoutTerminalDockGroups } from "./terminalDockGeometry";
import { uniqueTerminalDockId } from "./terminalDockNormalization";
import type {
  TerminalDockDropTarget,
  TerminalDockRect,
} from "./terminalDockLayout";

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
    id: uniqueTerminalDockId(`terminal-stack-${sourceTerminalId}`, nodeIds),
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
        id: uniqueTerminalDockId(`terminal-split-${sourceTerminalId}`, nodeIds),
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
      id: uniqueTerminalDockId(`terminal-group-${terminalId}`, groupIds),
      ...bounds,
      root: {
        id: uniqueTerminalDockId(`terminal-stack-${terminalId}`, nodeIds),
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

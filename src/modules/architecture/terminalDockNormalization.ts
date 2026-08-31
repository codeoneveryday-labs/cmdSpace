import type {
  ArchitectureDiagramNode,
  ArchitectureTerminalDockGroup,
  ArchitectureTerminalDockNode,
} from "@/modules/tabs";

type TerminalBounds = Pick<
  ArchitectureDiagramNode,
  "id" | "x" | "y" | "width" | "height"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveNumber(value: unknown): value is number {
  return finiteNumber(value) && value > 0;
}

export function uniqueTerminalDockId(
  preferred: string,
  usedIds: Set<string>,
): string {
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
    const preferredId = typeof value.id === "string" && value.id
      ? value.id
      : `terminal-stack-${terminalIds[0]}`;
    return {
      id: uniqueTerminalDockId(preferredId, usedNodeIds),
      kind: "tabs",
      terminalIds,
      activeTerminalId: typeof value.activeTerminalId === "string" && terminalIds.includes(value.activeTerminalId)
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
  const preferredId = typeof value.id === "string" && value.id
    ? value.id
    : "terminal-split";
  return {
    id: uniqueTerminalDockId(preferredId, usedNodeIds),
    kind: "split",
    direction: value.direction === "vertical" ? "vertical" : "horizontal",
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
      const preferredId = typeof value.id === "string" && value.id
        ? value.id
        : `terminal-group-${groups.length + 1}`;
      groups.push({
        id: uniqueTerminalDockId(preferredId, usedGroupIds),
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
      id: uniqueTerminalDockId(`terminal-group-${terminalNode.id}`, usedGroupIds),
      x: terminalNode.x,
      y: terminalNode.y,
      width: terminalNode.width,
      height: terminalNode.height,
      root: {
        id: uniqueTerminalDockId(`terminal-stack-${terminalNode.id}`, usedNodeIds),
        kind: "tabs",
        terminalIds: [terminalNode.id],
        activeTerminalId: terminalNode.id,
      },
    });
  }

  return groups;
}

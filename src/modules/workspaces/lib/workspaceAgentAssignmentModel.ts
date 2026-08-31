export function calculateAssignedCliTerminals(
  agentCounts: Record<string, number>,
): number {
  return Object.values(agentCounts).reduce((sum, count) => sum + count, 0);
}

export function calculateCliTerminalCapacity(
  totalTerminalCount: number,
  selectedImportSessionCount: number,
): number {
  return Math.max(0, totalTerminalCount - selectedImportSessionCount);
}

export function calculateRemainingAgentSlots(
  totalTerminalCount: number,
  selectedImportSessionCount: number,
  assignedCliTerminals: number,
): number {
  return Math.max(
    0,
    totalTerminalCount - selectedImportSessionCount - assignedCliTerminals,
  );
}

export function clampAgentCount(
  targetId: string,
  requestedCount: number,
  currentCounts: Record<string, number>,
  capacity: number,
): number {
  const currentCount = currentCounts[targetId] ?? 0;
  const currentTotal = Object.values(currentCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const otherCount = currentTotal - currentCount;
  return Math.min(
    Math.max(0, requestedCount),
    Math.max(0, capacity - otherCount),
  );
}

export function pruneAgentCountsToCapacity(
  currentCounts: Record<string, number>,
  capacity: number,
  allowedIds: string[],
): Record<string, number> {
  let remaining = capacity;
  const next: Record<string, number> = {};
  for (const id of allowedIds) {
    const count = Math.min(currentCounts[id] ?? 0, remaining);
    if (count > 0) {
      next[id] = count;
      remaining -= count;
    }
  }
  return next;
}

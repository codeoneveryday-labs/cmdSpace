export function resolveBroadcastTargets(
  enabled: boolean,
  sourceLeafId: number,
  selectedLeafIds: readonly number[],
  liveLeafIds: readonly number[],
): number[] {
  if (!enabled) return [sourceLeafId];

  const live = new Set(liveLeafIds);
  const targets = new Set<number>([sourceLeafId, ...selectedLeafIds]);
  return [...targets].filter((leafId) => live.has(leafId));
}

import { resolveBroadcastTargets } from "./terminalBroadcast";

type BroadcastConfig = {
  enabled: boolean;
  selectedLeafIds: number[];
};

const configByLeaf = new Map<number, BroadcastConfig>();

export function registerBroadcastTab(
  _tabId: number,
  leafIds: readonly number[],
  enabled: boolean,
  selectedLeafIds: readonly number[],
): void {
  const config = { enabled, selectedLeafIds: [...selectedLeafIds] };
  for (const leafId of leafIds) configByLeaf.set(leafId, config);
}

export function unregisterBroadcastLeaves(leafIds: readonly number[]): void {
  for (const leafId of leafIds) configByLeaf.delete(leafId);
}

export function broadcastTargetsForInput(
  sourceLeafId: number,
  liveLeafIds: readonly number[],
): number[] {
  const config = configByLeaf.get(sourceLeafId);
  return resolveBroadcastTargets(
    config?.enabled ?? false,
    sourceLeafId,
    config?.selectedLeafIds ?? [],
    liveLeafIds,
  );
}

export function clearBroadcastRuntime(): void {
  configByLeaf.clear();
}

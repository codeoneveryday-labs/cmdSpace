const MOUSE_TRACKING_REPORT = /^(?:\x1b\[<\d+;\d+;\d+[Mm]|\x1b\[M[\s\S]{3})+$/;

export function isMouseTrackingReport(input: string): boolean {
  return MOUSE_TRACKING_REPORT.test(input);
}

export function resolveBroadcastTargets(
  enabled: boolean,
  sourceLeafId: number,
  selectedLeafIds: readonly number[],
  liveLeafIds: readonly number[],
  input?: string,
): number[] {
  if (!enabled) return [sourceLeafId];
  if (input !== undefined && isMouseTrackingReport(input)) return [sourceLeafId];

  const live = new Set(liveLeafIds);
  const targets = new Set<number>([sourceLeafId, ...selectedLeafIds]);
  return [...targets].filter((leafId) => live.has(leafId));
}

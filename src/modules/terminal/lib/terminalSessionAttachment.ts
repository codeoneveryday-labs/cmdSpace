import type { TerminalSession } from "./terminalSessionModel";

type ReleasedSlot = {
  snapshot: string | null;
  cols: number;
  rows: number;
  altScreen: boolean;
};

export function unbindTerminalSessionFromSlot(
  leafId: number,
  session: TerminalSession,
  releaseSlot: (leafId: number) => ReleasedSlot | null,
): void {
  if (!session.hasSlot) return;
  const released = releaseSlot(leafId);
  if (released) {
    session.snapshot = released.snapshot;
    if (released.cols > 0) session.cols = released.cols;
    if (released.rows > 0) session.rows = released.rows;
    session.altScreenAtRelease = released.altScreen;
  }
  session.hasSlot = false;
  session.shellState = null;
}

export function detachTerminalSession({
  leafId,
  session,
  releaseSlot,
}: {
  leafId: number;
  session: TerminalSession;
  releaseSlot: (leafId: number) => ReleasedSlot | null;
}): void {
  unbindTerminalSessionFromSlot(leafId, session, releaseSlot);
  session.visibleNow = false;
  session.focusedNow = false;
  session.callbacks = {};
  session.container = null;
}

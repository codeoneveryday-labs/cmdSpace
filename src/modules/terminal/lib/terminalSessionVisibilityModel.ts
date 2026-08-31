import type { TerminalSession } from "./terminalSessionModel";

export function syncTerminalSessionVisibility({
  leafId,
  session,
  visible,
  focused,
  bindLeafToSlot,
  setSlotFocused,
  focusSlot,
}: {
  leafId: number;
  session: TerminalSession;
  visible: boolean;
  focused: boolean;
  bindLeafToSlot: (leafId: number, session: TerminalSession) => void;
  setSlotFocused: (leafId: number, focused: boolean) => void;
  focusSlot: (leafId: number) => void;
}): void {
  session.visibleNow = visible;
  session.focusedNow = focused;
  if (visible) {
    if (session.container && !session.hasSlot) bindLeafToSlot(leafId, session);
    setSlotFocused(leafId, focused);
    if (focused) focusSlot(leafId);
  } else {
    setSlotFocused(leafId, false);
  }
}

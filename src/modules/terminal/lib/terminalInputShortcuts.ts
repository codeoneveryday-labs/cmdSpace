export type TerminalEditKeyEvent = Pick<
  KeyboardEvent,
  "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
>;

export function terminalEditingSequence(
  event: TerminalEditKeyEvent,
  isMac: boolean,
): string | null {
  if (
    isMac &&
    event.metaKey &&
    event.shiftKey &&
    !event.ctrlKey &&
    !event.altKey &&
    (event.key === "Backspace" ||
      event.code === "Backspace" ||
      event.key === "Delete" ||
      event.code === "Delete")
  ) {
    return "\x15\x0b";
  }

  const editingModifier = isMac ? event.metaKey : event.ctrlKey;
  if (editingModifier && (event.key === "Backspace" || event.code === "Backspace")) {
    return "\x17";
  }
  if (editingModifier && (event.key === "Delete" || event.code === "Delete")) {
    return "\x0b";
  }
  if (event.key === "Enter" && event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
    return "\x1b\r";
  }
  return null;
}

export function isTerminalCopyShortcut(
  event: TerminalEditKeyEvent,
  isMac: boolean,
): boolean {
  return (
    !isMac &&
    event.ctrlKey &&
    event.shiftKey &&
    !event.altKey &&
    !event.metaKey &&
    (event.code === "KeyC" || event.key === "c" || event.key === "C")
  );
}

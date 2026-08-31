type KeyboardLikeEvent = Pick<KeyboardEvent, "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "key" | "code">;

function isMacPlatform(userAgent: string): boolean {
  return /Mac|iPhone|iPad/.test(userAgent);
}

function currentUserAgent(): string {
  return typeof navigator === "undefined" ? "" : navigator.userAgent;
}

export function isTerminalCopy(event: KeyboardLikeEvent, userAgent = currentUserAgent()): boolean {
  const isMac = isMacPlatform(userAgent);
  const hasModifier = isMac
    ? event.metaKey && !event.ctrlKey && !event.altKey
    : event.ctrlKey && event.shiftKey && !event.altKey && !event.metaKey;
  return hasModifier && (event.code === "KeyC" || event.key === "c" || event.key === "C");
}

export function isTerminalPaste(event: KeyboardLikeEvent, userAgent = currentUserAgent()): boolean {
  const isMac = isMacPlatform(userAgent);
  const hasModifier = isMac
    ? (event.metaKey || event.ctrlKey) && !event.altKey
    : event.ctrlKey && !event.altKey && !event.metaKey;
  return hasModifier && (event.code === "KeyV" || event.key === "v" || event.key === "V");
}

export function isDeletePreviousWord(event: KeyboardLikeEvent, userAgent = currentUserAgent()): boolean {
  const modifier = isMacPlatform(userAgent) ? event.metaKey : event.ctrlKey;
  return modifier && !event.shiftKey && !event.altKey && (event.key === "Backspace" || event.code === "Backspace");
}

export function isDeleteToEndOfLine(event: KeyboardLikeEvent, userAgent = currentUserAgent()): boolean {
  const modifier = isMacPlatform(userAgent) ? event.metaKey : event.ctrlKey;
  return modifier && !event.shiftKey && !event.altKey && (event.key === "Delete" || event.code === "Delete");
}

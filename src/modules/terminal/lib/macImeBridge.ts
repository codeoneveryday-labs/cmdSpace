export const IS_MAC_TEXT_INPUT_PLATFORM =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

export function normalizeMacTerminalInput(value: string): string {
  // WebKit's macOS text bridge can occasionally surface an intended space as
  // invisible C1 controls (U+0080–U+009F) or as Unicode space lookalikes
  // (no-break space U+00A0, thin/medium spaces U+2000–U+200A, narrow no-break
  // space U+202F, word joiner U+2060, ideographic space U+3000). Zsh then
  // treats both visible words as one command. Collapse every such separator
  // into a regular space so the shell can split it.
  return value.replace(
    /[\u0080-\u009f\u00a0\u2000-\u200a\u202f\u205f\u2060\u3000]+/g,
    " ",
  );
}

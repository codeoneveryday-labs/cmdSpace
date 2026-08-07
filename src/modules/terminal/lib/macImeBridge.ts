import type { Terminal } from "@xterm/xterm";

export const IS_MAC_TEXT_INPUT_PLATFORM =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

export function shouldUseMacTextInputPath(event: KeyboardEvent): boolean {
  if (!IS_MAC_TEXT_INPUT_PLATFORM) return false;
  if (event.type !== "keydown" && event.type !== "keypress") return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.key === " ") return false;
  return event.key.length === 1 && !isControlKey(event.key);
}

export function shouldIgnoreMacPrintableTerminalData(data: string): boolean {
  return (
    IS_MAC_TEXT_INPUT_PLATFORM &&
    data.length === 1 &&
    data.charCodeAt(0) >= 0x20 &&
    data.charCodeAt(0) !== 0x20 &&
    data.charCodeAt(0) !== 0x7f
  );
}

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

export function attachMacImeBridge(
  terminal: Terminal,
  writeToPty: (data: string) => void,
): void {
  if (!IS_MAC_TEXT_INPUT_PLATFORM || !terminal.textarea) return;

  const textarea = terminal.textarea;
  let lastValue = textarea.value;
  let composing = false;
  let compositionStartValue = textarea.value;
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  );

  if (descriptor?.set) {
    const originalSet = descriptor.set;
    Object.defineProperty(textarea, "value", {
      ...descriptor,
      set: function (value) {
        lastValue = value;
        if (!composing) compositionStartValue = value;
        originalSet.call(this, value);
      },
    });
  }

  const writeDiff = (fromValue: string) => {
    const value = textarea.value;
    // WebKit can store the intended space as a C1 control or NBSP in the
    // textarea, while the next keystroke arrives as a regular space. Compare
    // both sides normalized so the common-prefix diff never mistakes the
    // lookalike for a real character change (which would emit a spurious
    // DEL and delete the previous character).
    const from = normalizeMacTerminalInput(fromValue);
    const to = normalizeMacTerminalInput(value);
    if (to === from) return;

    let commonPrefixLen = 0;
    const minLength = Math.min(from.length, to.length);
    while (
      commonPrefixLen < minLength &&
      from.charCodeAt(commonPrefixLen) === to.charCodeAt(commonPrefixLen)
    ) {
      commonPrefixLen++;
    }

    const backspaces = from.length - commonPrefixLen;
    const appendText = to.slice(commonPrefixLen);
    const data = normalizeMacTerminalInput(
      "\x7f".repeat(backspaces) + appendText,
    );
    if (data) writeToPty(data);
    lastValue = value;
  };

  textarea.addEventListener(
    "compositionstart",
    (event) => {
      event.stopImmediatePropagation();
      composing = true;
      compositionStartValue = textarea.value;
    },
    true,
  );
  textarea.addEventListener(
    "compositionupdate",
    (event) => event.stopImmediatePropagation(),
    true,
  );
  textarea.addEventListener(
    "compositionend",
    (event) => {
      event.stopImmediatePropagation();
      composing = false;
      writeDiff(compositionStartValue);
    },
    true,
  );
  for (const eventName of ["beforeinput", "textInput", "textinput"] as const) {
    textarea.addEventListener(
      eventName,
      (event) => event.stopImmediatePropagation(),
      true,
    );
  }
  textarea.addEventListener(
    "input",
    (event) => {
      event.stopImmediatePropagation();
      if (composing) return;
      const input = event as InputEvent;
      // xterm's native paste listener already forwards this payload. Keep the
      // bridge's textarea state in sync without sending it to the PTY again.
      if (input.inputType === "insertFromPaste") {
        lastValue = textarea.value;
        return;
      }
      if (input.inputType && !input.inputType.startsWith("insert")) {
        lastValue = textarea.value;
        return;
      }
      writeDiff(lastValue);
    },
    true,
  );
}

function isControlKey(key: string): boolean {
  return key.charCodeAt(0) < 0x20 || key.charCodeAt(0) === 0x7f;
}

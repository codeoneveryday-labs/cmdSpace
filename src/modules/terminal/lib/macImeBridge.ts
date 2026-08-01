import type { Terminal } from "@xterm/xterm";

export const IS_MAC_TEXT_INPUT_PLATFORM =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

export function shouldUseMacTextInputPath(event: KeyboardEvent): boolean {
  if (!IS_MAC_TEXT_INPUT_PLATFORM) return false;
  if (event.type !== "keydown" && event.type !== "keypress") return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  return event.key.length === 1 && !isControlKey(event.key);
}

export function shouldIgnoreMacPrintableTerminalData(data: string): boolean {
  return (
    IS_MAC_TEXT_INPUT_PLATFORM &&
    data.length === 1 &&
    data.charCodeAt(0) >= 0x20 &&
    data.charCodeAt(0) !== 0x7f
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
    if (value === fromValue) return;

    let commonPrefixLen = 0;
    const minLength = Math.min(fromValue.length, value.length);
    while (
      commonPrefixLen < minLength &&
      fromValue.charCodeAt(commonPrefixLen) === value.charCodeAt(commonPrefixLen)
    ) {
      commonPrefixLen++;
    }

    const backspaces = fromValue.length - commonPrefixLen;
    const appendText = value.slice(commonPrefixLen);
    const data = "\x7f".repeat(backspaces) + appendText;
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

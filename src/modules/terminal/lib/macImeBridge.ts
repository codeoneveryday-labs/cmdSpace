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

/** True for an unmodified space keypress on macOS. A plain space is never IME
 *  composition: xterm's `evaluateKeyboardEvent` maps it to no key and does not
 *  preventDefault, so both the browser textarea insertion (→ bridge `input`)
 *  and the follow-up `keypress` (→ xterm `onData`) would fire. Callers should
 *  `preventDefault()` and write the space exactly once instead. */
export function isPlainSpaceKey(event: KeyboardEvent): boolean {
  if (event.type !== "keydown" && event.type !== "keypress") return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (event.isComposing || event.keyCode === 229 || event.key === "Process") {
    return false;
  }
  return event.key === " ";
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

/**
 * WebKit can make one committed IME value visible to both xterm's `onData`
 * callback and our textarea bridge. Keep xterm's payload (which also covers
 * native paste), and discard the bridge duplicate when it arrives in the same
 * event turn.
 */
export function createMacTextInputDeduplicator(
  writeToPty: (data: string) => void,
): {
  writeXtermData: (data: string) => void;
  writeBridgeData: (data: string) => void;
} {
  let pendingXtermData: string | null = null;

  return {
    writeXtermData(data) {
      if (!isPrintableTerminalData(data)) {
        writeToPty(data);
        return;
      }
      pendingXtermData = data;
      queueMicrotask(() => {
        if (pendingXtermData !== data) return;
        pendingXtermData = null;
        writeToPty(data);
      });
    },
    writeBridgeData(data) {
      if (pendingXtermData === data) {
        pendingXtermData = null;
        writeToPty(data);
        return;
      }
      writeToPty(data);
    },
  };
}

function isPrintableTerminalData(data: string): boolean {
  return (
    data.length > 0 &&
    Array.from(data).every(
      (character) =>
        character.charCodeAt(0) >= 0x20 && character.charCodeAt(0) !== 0x7f,
    )
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
  let compositionStartTime = 0;
  /** Guard against a composition that never fires `compositionend` (user
   *  cancels, clicks away, the keydown was consumed elsewhere). If the flag is
   *  stuck, every subsequent `input` is swallowed and typed characters never
   *  reach the PTY until a non-input key (space/arrow) breaks the pattern. */
  const COMPOSITION_WATCHDOG_MS = 1_000;
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
      compositionStartTime = Date.now();
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
      compositionStartTime = 0;
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
      const input = event as InputEvent;
      // A real, active composition produces insertCompositionText inputs with
      // isComposing true. If we're flagged composing but the textarea receives
      // non-composition text instead — the browser says composition is over, or
      // the flag has been stuck past the watchdog window — the compositionend
      // was lost. Force-clear so typing isn't swallowed until the next
      // space/arrow, and sync lastValue so no stale diff is emitted.
      const staleComposition =
        composing &&
        (input.isComposing === false ||
          (input.inputType &&
            input.inputType !== "insertCompositionText" &&
            Date.now() - compositionStartTime > COMPOSITION_WATCHDOG_MS));
      if (staleComposition) {
        composing = false;
        compositionStartTime = 0;
        lastValue = textarea.value;
      }
      if (composing) return;
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

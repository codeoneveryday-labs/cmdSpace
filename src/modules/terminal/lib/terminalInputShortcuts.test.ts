import { describe, expect, it } from "vitest";

import {
  isTerminalCopyShortcut,
  terminalEditingSequence,
} from "./terminalInputShortcuts";

const key = (overrides: Partial<KeyboardEvent> = {}) =>
  ({
    key: "",
    code: "",
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...overrides,
  }) as Pick<
    KeyboardEvent,
    "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey"
  >;

describe("terminal editing shortcuts", () => {
  it("clears both sides of a macOS prompt before other delete shortcuts", () => {
    expect(
      terminalEditingSequence(key({ metaKey: true, shiftKey: true, key: "Delete" }), true),
    ).toBe("\x15\x0b");
  });

  it("maps modifier backspace and delete to readline editing sequences", () => {
    expect(
      terminalEditingSequence(key({ metaKey: true, key: "Backspace" }), true),
    ).toBe("\x17");
    expect(
      terminalEditingSequence(key({ ctrlKey: true, key: "Delete" }), false),
    ).toBe("\x0b");
  });

  it("maps shift-enter to an escaped newline without intercepting ordinary enter", () => {
    expect(terminalEditingSequence(key({ key: "Enter", shiftKey: true }), false)).toBe(
      "\x1b\r",
    );
    expect(terminalEditingSequence(key({ key: "Enter" }), false)).toBeNull();
  });

  it("keeps copy-on-selection shortcut unavailable on macOS", () => {
    expect(
      isTerminalCopyShortcut(key({ ctrlKey: true, shiftKey: true, key: "c", code: "KeyC" }), false),
    ).toBe(true);
    expect(
      isTerminalCopyShortcut(key({ ctrlKey: true, shiftKey: true, key: "c", code: "KeyC" }), true),
    ).toBe(false);
  });
});

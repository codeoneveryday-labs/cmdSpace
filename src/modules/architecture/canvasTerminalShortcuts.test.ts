import { describe, expect, it } from "vitest";
import {
  isDeletePreviousWord,
  isDeleteToEndOfLine,
  isTerminalCopy,
  isTerminalPaste,
} from "./canvasTerminalShortcuts";

const event = (overrides: Partial<KeyboardEvent>) => ({
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  key: "",
  code: "",
  ...overrides,
});

describe("canvasTerminalShortcuts", () => {
  it("maps copy and paste for macOS and other platforms", () => {
    expect(isTerminalCopy(event({ metaKey: true, key: "c", code: "KeyC" }), "Macintosh")).toBe(true);
    expect(isTerminalCopy(event({ ctrlKey: true, shiftKey: true, key: "c", code: "KeyC" }), "Windows")).toBe(true);
    expect(isTerminalPaste(event({ metaKey: true, key: "v", code: "KeyV" }), "Macintosh")).toBe(true);
    expect(isTerminalPaste(event({ ctrlKey: true, key: "v", code: "KeyV" }), "Windows")).toBe(true);
  });

  it("maps platform-aware line deletion shortcuts", () => {
    expect(isDeletePreviousWord(event({ metaKey: true, key: "Backspace" }), "Macintosh")).toBe(true);
    expect(isDeletePreviousWord(event({ ctrlKey: true, key: "Backspace" }), "Windows")).toBe(true);
    expect(isDeleteToEndOfLine(event({ metaKey: true, key: "Delete" }), "Macintosh")).toBe(true);
    expect(isDeleteToEndOfLine(event({ ctrlKey: true, key: "Delete" }), "Windows")).toBe(true);
  });
});

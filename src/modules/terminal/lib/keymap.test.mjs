import { describe, expect, it } from "vitest";
import {
  terminalLineBoundarySequence,
  terminalWordNavigationSequence,
} from "./keymap";

describe("terminalWordNavigationSequence", () => {
  it("maps Option+Left to readline word-left", () => {
    expect(
      terminalWordNavigationSequence({
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        key: "ArrowLeft",
        code: "ArrowLeft",
      }),
    ).toBe("\x1bb");
  });

  it("maps Option+Right to readline word-right", () => {
    expect(
      terminalWordNavigationSequence({
        altKey: true,
        ctrlKey: false,
        metaKey: false,
        key: "ArrowRight",
        code: "ArrowRight",
      }),
    ).toBe("\x1bf");
  });

  it("does not remap plain arrows", () => {
    expect(
      terminalWordNavigationSequence({
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        key: "ArrowLeft",
        code: "ArrowLeft",
      }),
    ).toBe(null);
  });
});

describe("terminalLineBoundarySequence", () => {
  it("maps Cmd+Shift+Left to readline beginning-of-line", () => {
    expect(
      terminalLineBoundarySequence({
        altKey: false,
        ctrlKey: false,
        metaKey: true,
        shiftKey: true,
        key: "ArrowLeft",
        code: "ArrowLeft",
      }),
    ).toBe("\x01");
  });

  it("maps Cmd+Shift+Right to readline end-of-line", () => {
    expect(
      terminalLineBoundarySequence({
        altKey: false,
        ctrlKey: false,
        metaKey: true,
        shiftKey: true,
        key: "ArrowRight",
        code: "ArrowRight",
      }),
    ).toBe("\x05");
  });

  it("leaves Cmd+Arrow without Shift for pane navigation", () => {
    expect(
      terminalLineBoundarySequence({
        altKey: false,
        ctrlKey: false,
        metaKey: true,
        shiftKey: false,
        key: "ArrowLeft",
        code: "ArrowLeft",
      }),
    ).toBe(null);
  });
});

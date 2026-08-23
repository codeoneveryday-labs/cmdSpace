import fs from "node:fs";
import { describe, expect, it } from "vitest";

function loadKeymapFunction(name) {
  const source = fs.readFileSync(
    new URL("./keymap.ts", import.meta.url),
    "utf8",
  );
  const match = source.match(
    new RegExp(
      `export function ${name}\\(event: TerminalKeyEvent\\): string \\| null \\{([\\s\\S]*?)\\n\\}`,
    ),
  );
  if (!match) throw new Error(`${name} export not found`);
  return new Function(
    `return function ${name}(event) {${match[1]}\n}`,
  )();
}

describe("terminalWordNavigationSequence", () => {
  it("maps Option+Left to readline word-left", () => {
    const terminalWordNavigationSequence = loadKeymapFunction(
      "terminalWordNavigationSequence",
    );

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
    const terminalWordNavigationSequence = loadKeymapFunction(
      "terminalWordNavigationSequence",
    );

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
    const terminalWordNavigationSequence = loadKeymapFunction(
      "terminalWordNavigationSequence",
    );

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
    const terminalLineBoundarySequence = loadKeymapFunction(
      "terminalLineBoundarySequence",
    );

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
    const terminalLineBoundarySequence = loadKeymapFunction(
      "terminalLineBoundarySequence",
    );

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
    const terminalLineBoundarySequence = loadKeymapFunction(
      "terminalLineBoundarySequence",
    );

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

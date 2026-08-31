import { describe, expect, it } from "vitest";
import { readTerminalBuffer, readTerminalSelection } from "./terminalSessionReadback";

describe("terminalSessionReadback", () => {
  it("reads the tail from a live terminal buffer", () => {
    const lines = ["one", "two", "three"].map((value) => ({
      translateToString: () => value,
    }));
    expect(
      readTerminalBuffer({
        buffer: { length: lines.length, getLine: (index) => lines[index] },
        snapshot: null,
        maxLines: 2,
      }),
    ).toBe("two\nthree");
  });

  it("falls back to a serialized snapshot and normalizes empty selection", () => {
    expect(
      readTerminalBuffer({ buffer: undefined, snapshot: "one\ntwo", maxLines: 1 }),
    ).toBe("two");
    expect(readTerminalSelection("selected")).toBe("selected");
    expect(readTerminalSelection(" ")).toBe(" ");
    expect(readTerminalSelection("")).toBeNull();
    expect(readTerminalSelection(null)).toBeNull();
  });
});

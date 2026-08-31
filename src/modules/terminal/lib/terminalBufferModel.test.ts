import { describe, expect, it } from "vitest";
import { tailTerminalLines, tailTerminalSnapshot } from "./terminalBufferModel";

describe("terminalBufferModel", () => {
  it("returns the bounded tail without trailing blank lines", () => {
    expect(tailTerminalLines(["one", "two", "", ""], 3)).toBe("two");
  });

  it("strips ANSI sequences before returning a snapshot tail", () => {
    expect(tailTerminalSnapshot("\u001b[31merror\u001b[0m\nnext\n", 5)).toBe("error\nnext");
  });
});

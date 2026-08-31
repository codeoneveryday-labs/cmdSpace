import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./terminalDockMutations.ts", import.meta.url),
  "utf8",
);

describe("terminalDockMutations contract", () => {
  it("owns dock tree updates without React state or IPC", () => {
    expect(source).toContain("dockTerminal");
    expect(source).toContain("detachTerminal");
    expect(source).toContain("removeTerminalFromDock");
    expect(source).toContain("updateTerminalDockSplitRatio");
    expect(source).not.toContain("useState");
    expect(source).not.toContain("invoke(");
  });
});

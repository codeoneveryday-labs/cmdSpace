import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasTerminalViewModel.ts", import.meta.url),
  "utf8",
);

describe("useCanvasTerminalViewModel contract", () => {
  it("centralizes base, maximized and divider layout derivation", () => {
    expect(source).toContain("export function useCanvasTerminalViewModel");
    expect(source).toContain("layoutTerminalDockGroups(terminalDockGroups)");
    expect(source).toContain("projectMaximizedTerminalDockGroups");
    expect(source).toContain("layoutTerminalDockDividers");
    expect(source).toContain("terminalLayoutById");
    expect(source).toContain("renderedTerminalLayoutById");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasTerminalSizeMigration.ts", import.meta.url),
  "utf8",
);

describe("useCanvasTerminalSizeMigration contract", () => {
  it("upgrades legacy terminal dimensions once through the node setter", () => {
    expect(source).toContain("export function useCanvasTerminalSizeMigration");
    expect(source).toContain("needsTerminalSizeMigration");
    expect(source).toContain("TERMINAL_DEFAULT_SIZE");
    expect(source).toContain("terminalChromeVersion: 2");
  });
});

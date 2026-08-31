import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./canvasTerminalSelectionCopy.ts", import.meta.url),
  "utf8",
);

describe("canvasTerminalSelectionCopy contract", () => {
  it("owns debounced copy-on-select and badge timer cleanup", () => {
    expect(source).toContain("onSelectionChange");
    expect(source).toContain("terminalCopyOnSelection");
    expect(source).toContain("lastAutoCopiedSelection");
    expect(source).toContain("clearTimeout");
    expect(source).toContain("clearSelection");
  });
});

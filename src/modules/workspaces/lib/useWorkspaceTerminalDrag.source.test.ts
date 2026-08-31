import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useWorkspaceTerminalDrag.ts", import.meta.url),
  "utf8",
);

describe("useWorkspaceTerminalDrag contract", () => {
  it("owns pointer lifecycle and terminal swap targeting", () => {
    expect(source).toContain("useWorkspaceTerminalDrag");
    expect(source).toContain("elementsFromPoint");
    expect(source).toContain("onSwapTerminals");
    expect(source).toContain("pointercancel");
    expect(source).toContain("startTerminalDrag");
  });
});

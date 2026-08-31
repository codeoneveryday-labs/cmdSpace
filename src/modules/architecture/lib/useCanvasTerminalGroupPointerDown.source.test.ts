import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasTerminalGroupPointerDown.ts", import.meta.url),
  "utf8",
);

describe("useCanvasTerminalGroupPointerDown contract", () => {
  it("keeps group drag offset, lock guard and pointer capture together", () => {
    expect(source).toContain("export function useCanvasTerminalGroupPointerDown");
    expect(source).toContain('mode !== "select"');
    expect(source).toContain("if (locked) return;");
    expect(source).toContain("sourceBounds: group");
    expect(source).toContain("terminalGroupId: group.id");
    expect(source).toContain("setPointerCapture(event.pointerId)");
  });
});

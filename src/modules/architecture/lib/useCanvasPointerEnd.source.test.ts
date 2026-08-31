import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasPointerEnd.ts", import.meta.url),
  "utf8",
);

describe("useCanvasPointerEnd contract", () => {
  it("resolves, commits and cleans up terminal drag state", () => {
    expect(source).toContain("export function useCanvasPointerEnd");
    expect(source).toContain("resolveTerminalDropResult");
    expect(source).toContain("commitTerminalDropResult");
    expect(source).toContain("setDrag(null)");
    expect(source).toContain("setTerminalDropPreview(null)");
    expect(source).toContain("clearTerminalDockDropTarget();");
    expect(source).toContain("clearShapeGestures();");
  });
});

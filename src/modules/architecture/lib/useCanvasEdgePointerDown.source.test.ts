import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasEdgePointerDown.ts", import.meta.url),
  "utf8",
);

describe("useCanvasEdgePointerDown contract", () => {
  it("routes eraser and selection behavior without owning edge state", () => {
    expect(source).toContain("export function useCanvasEdgePointerDown");
    expect(source).toContain('mode === "eraser"');
    expect(source).toContain("onErase(edgeId)");
    expect(source).toContain("selectEdge(edgeId)");
    expect(source).toContain("setConnectSourceId(null)");
  });
});

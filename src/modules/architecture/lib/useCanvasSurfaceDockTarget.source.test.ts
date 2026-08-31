import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasSurfaceDockTarget.ts", import.meta.url),
  "utf8",
);

describe("useCanvasSurfaceDockTarget contract", () => {
  it("projects the canvas viewport before resolving a surface target", () => {
    expect(source).toContain("export function useCanvasSurfaceDockTarget");
    expect(source).toContain("projectTerminalDockLayouts");
    expect(source).toContain("svgRef.current?.getBoundingClientRect()");
    expect(source).toContain("if (projectedLayouts.length === 0)");
    expect(source).toContain("resolveTarget(point, surfaceId)");
  });
});

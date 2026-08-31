import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasSurfacePlacementActions.ts", import.meta.url),
  "utf8",
);

describe("useCanvasSurfacePlacementActions contract", () => {
  it("owns placement planning and terminal/browser creation actions", () => {
    expect(source).toContain("export function useCanvasSurfacePlacementActions");
    expect(source).toContain("recommendTerminalPlacements");
    expect(source).toContain("createDockedSurfaceState");
    expect(source).toContain("commitSurfacePlacement");
    expect(source).toContain("commitFreeSurfacePlacement");
    expect(source).toContain("pendingTerminalCommandRef.current = undefined");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./architectureSurfaceModel.ts", import.meta.url),
  "utf8",
);

describe("architectureSurfaceModel contract", () => {
  it("centralizes surface placement anchors and inherited terminal cwd", () => {
    expect(source).toContain("surfacePlacementAnchor");
    expect(source).toContain("inheritedSurfaceCwd");
    expect(source).toContain("activeSurfaceId");
    expect(source).toContain("terminalNodes[0]?.cwd");
    expect(source).toContain("distance");
  });
});

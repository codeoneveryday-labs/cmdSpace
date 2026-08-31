import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "CanvasPlacementOverlay.tsx",
  ),
  "utf8",
);

describe("CanvasPlacementOverlay contract", () => {
  it("keeps free placement and ranked placement behind callbacks", () => {
    expect(source).toContain("onPlaceFreeSurface");
    expect(source).toContain("onPlaceSurface");
    expect(source).toContain("Pick a spot");
    expect(source).toContain("Click anywhere to place");
  });
});

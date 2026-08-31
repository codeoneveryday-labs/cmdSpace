import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const canvasSource = readFileSync(join(here, "../ArchitectureCanvas.tsx"), "utf8");
const placementSource = readFileSync(join(here, "useCanvasPlacement.ts"), "utf8");

describe("ArchitectureCanvas placement state seam", () => {
  it("keeps placement state and actions in useCanvasPlacement", () => {
    expect(canvasSource).toContain("const placement = useCanvasPlacement();");
    expect(canvasSource).toContain("isFreePlacement: isFreeTerminalPlacement");
    expect(placementSource).toContain("INITIAL_CANVAS_PLACEMENT_STATE");
    expect(placementSource).toContain("startSurfacePlacement");
    expect(placementSource).toContain("clearSurfacePlacement");
  });
});

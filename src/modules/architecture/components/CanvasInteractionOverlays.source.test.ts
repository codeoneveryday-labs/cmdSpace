import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./CanvasInteractionOverlays.tsx", import.meta.url),
  "utf8",
);

describe("CanvasInteractionOverlays contract", () => {
  it("renders drop, placement and status overlays without persistence or IPC", () => {
    expect(source).toContain("export function CanvasInteractionOverlays");
    expect(source).toContain("Drop to place");
    expect(source).toContain("data-terminal-drop-target");
    expect(source).toContain("CanvasPlacementOverlay");
    expect(source).toContain("CanvasStatusOverlay");
    expect(source).not.toContain("invoke(");
    expect(source).not.toContain("onDiagramChange");
  });
});

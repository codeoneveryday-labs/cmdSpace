import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./useCanvasDiagramViewModel.ts", import.meta.url),
  "utf8",
);

describe("useCanvasDiagramViewModel contract", () => {
  it("centralizes selected-node and live-surface selectors", () => {
    expect(source).toContain("useCanvasDiagramViewModel");
    expect(source).toContain("selectedNode");
    expect(source).toContain("selectedEdge");
    expect(source).toContain("nodeById");
    expect(source).toContain("liveSurfaceNodes");
    expect(source).toContain("terminalNodes");
    expect(source).toContain("interactiveSurfaceNodes");
  });
});

import { describe, expect, it } from "vitest";
import { createCanvasNode } from "./architectureDiagramSeed";

const bounds = { x: 0, y: 0, width: 1200, height: 720 };

describe("createCanvasNode", () => {
  it("centers regular nodes and clamps them inside drawable bounds", () => {
    const node = createCanvasNode({
      id: "n1",
      kind: "service",
      point: { x: -100, y: -100 },
      bounds,
    });

    expect(node.x).toBe(16);
    expect(node.y).toBe(16);
    expect(node.label).toBe("Service");
  });

  it("preserves drawing semantics for lines and pens", () => {
    const line = createCanvasNode({
      id: "n2",
      kind: "line",
      point: { x: 120, y: 140 },
      bounds,
      fromDrag: true,
    });
    const pen = createCanvasNode({
      id: "n3",
      kind: "pen",
      point: { x: 120, y: 140 },
      bounds,
      fromDrag: true,
    });

    expect(line).toMatchObject({ x: 120, y: 140, width: 1, height: 1 });
    expect(pen).toMatchObject({ points: [{ x: 0, y: 0 }], width: 1, height: 1 });
  });
});

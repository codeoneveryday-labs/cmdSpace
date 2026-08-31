import { describe, expect, it } from "vitest";

import type { ArchitectureNode, DrawingState } from "./architectureCanvasTypes";
import { updateDrawingNode } from "./architectureDrawingModel";

function drawingNode(kind: ArchitectureNode["kind"]): ArchitectureNode {
  return {
    id: "drawing-1",
    kind,
    label: "",
    technology: "",
    x: 10,
    y: 20,
    width: 1,
    height: 1,
  };
}

describe("updateDrawingNode", () => {
  it("does not add a pen point within the minimum stroke distance", () => {
    const node = {
      ...drawingNode("pen"),
      points: [{ x: 0, y: 0 }],
      width: 10,
      height: 10,
    };
    const drawing: DrawingState = {
      id: node.id,
      kind: "pen",
      start: { x: 10, y: 20 },
    };

    expect(updateDrawingNode(node, drawing, { x: 12, y: 21 }, [node])).toBe(node);
  });

  it("stores unsnapped connector geometry relative to the drawing start", () => {
    const node = drawingNode("line");
    const drawing: DrawingState = {
      id: node.id,
      kind: "line",
      start: { x: 10, y: 20 },
    };

    expect(updateDrawingNode(node, drawing, { x: 40, y: 55 }, [node])).toMatchObject({
      x: 10,
      y: 20,
      width: 30,
      height: 35,
      points: [{ x: 15, y: 17.5 }],
      connectorStartId: undefined,
      connectorEndId: undefined,
    });
  });
});

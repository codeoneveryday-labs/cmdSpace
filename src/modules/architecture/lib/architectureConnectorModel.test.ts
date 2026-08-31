import { describe, expect, it } from "vitest";

import type { ArchitectureNode } from "./architectureCanvasTypes";
import { updateConnectorHandle } from "./architectureConnectorModel";

function node(id: string, kind: ArchitectureNode["kind"], x: number, y: number): ArchitectureNode {
  return {
    id,
    kind,
    label: id,
    technology: "",
    x,
    y,
    width: 100,
    height: 100,
  };
}

describe("updateConnectorHandle", () => {
  it("snaps an end handle to the nearest eligible node boundary", () => {
    const connector: ArchitectureNode = {
      ...node("connector", "line", 0, 0),
      width: 100,
      height: 0,
      points: [{ x: 50, y: 50 }],
    };
    const target = node("target", "service", 200, 0);

    expect(
      updateConnectorHandle(
        connector,
        { id: connector.id, handle: "end" },
        { x: 203, y: 50 },
        [connector, target],
      ),
    ).toMatchObject({
      x: 0,
      y: 0,
      width: 200,
      height: 50,
      points: [{ x: 50, y: 50 }],
      connectorEndId: "target",
    });
  });
});

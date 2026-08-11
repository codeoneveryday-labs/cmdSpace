import { describe, expect, it } from "vitest";

import {
  connectorGeometry,
  edgeAnchorPoint,
  resolveConnectorNode,
  snapConnectorEndpoint,
} from "./canvasGeometry";

describe("canvas geometry", () => {
  it("anchors connector endpoints to their attached nodes while retaining its control point", () => {
    const connector = {
      id: "connector",
      kind: "arrow",
      x: 10,
      y: 20,
      width: 300,
      height: 100,
      points: [{ x: 120, y: 30 }],
      connectorStartId: "source",
      connectorEndId: "target",
    };
    const nodes = [
      { id: "source", kind: "service", x: 0, y: 0, width: 80, height: 60 },
      { id: "target", kind: "database", x: 280, y: 100, width: 100, height: 80 },
    ];

    expect(connectorGeometry(connector, [connector, ...nodes])).toEqual({
      start: { x: 80, y: 45.172413793103445 },
      control: { x: 130, y: 50 },
      end: { x: 280, y: 121.03448275862068 },
    });
    expect(resolveConnectorNode(connector, [connector, ...nodes])).toMatchObject({
      x: 80,
      y: 45.172413793103445,
      width: 200,
      height: 75.86206896551724,
      points: [{ x: 50, y: 4.827586206896555 }],
    });
  });

  it("snaps to a nearby node boundary but ignores drawing-only nodes", () => {
    const connector = {
      id: "connector",
      kind: "arrow",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    };
    const nearbyService = {
      id: "service",
      kind: "service",
      x: 100,
      y: 100,
      width: 100,
      height: 80,
    };

    expect(
      snapConnectorEndpoint(
        { x: 96, y: 130 },
        connector,
        [connector, { ...nearbyService, id: "line", kind: "line" }, nearbyService],
        12,
      ),
    ).toEqual({
      nodeId: "service",
      point: { x: 100, y: 130.74074074074073 },
    });
  });

  it("places directional edges on the source boundary and overlaps their destination", () => {
    const source = { id: "source", kind: "service", x: 0, y: 0, width: 100, height: 80 };
    const target = { id: "target", kind: "database", x: 200, y: 0, width: 80, height: 80 };

    expect(edgeAnchorPoint(source, target, false)).toEqual({ x: 100, y: 40 });
    expect(edgeAnchorPoint(target, source, true)).toEqual({ x: 204, y: 40 });
  });
});

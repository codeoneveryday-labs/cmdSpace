import { describe, expect, it } from "vitest";
import {
  applyCanvasDragMove,
  attachedTerminalGroupIdsForFrameMove,
  inheritedSurfaceCwd,
  resolveCanvasDragMove,
  surfacePlacementAnchor,
} from "./architectureCanvasModel";
import type { ArchitectureNode } from "./architectureCanvasTypes";

const node = (id: string, kind: "terminal" | "browser", x: number): ArchitectureNode => ({
  id,
  kind,
  label: id,
  technology: "",
  x,
  y: 20,
  width: 100,
  height: 80,
});

describe("surfacePlacementAnchor", () => {
  const view = { x: 0, y: 0, width: 1000, height: 600 };

  it("prefers the active or selected surface over proximity", () => {
    const surfaces = [node("near", "terminal", 450), node("active", "terminal", 0)];

    expect(surfacePlacementAnchor(surfaces, "terminal", "active", null, view)).toMatchObject({
      x: 0,
      y: 20,
    });
  });

  it("uses the nearest surface of the requested kind when no surface is active", () => {
    const surfaces = [node("terminal", "terminal", 450), node("browser", "browser", 480)];

    expect(surfacePlacementAnchor(surfaces, "terminal", "", null, view)?.x).toBe(450);
  });
});

describe("inheritedSurfaceCwd", () => {
  it("prefers active, then selected, then first terminal cwd", () => {
    const terminals = [
      { ...node("first", "terminal", 0), cwd: "/first" },
      { ...node("active", "terminal", 100), cwd: "/active" },
    ];

    expect(inheritedSurfaceCwd(terminals, "active", null)).toBe("/active");
    expect(inheritedSurfaceCwd(terminals, "missing", terminals[1] ?? null)).toBe("/active");
    expect(inheritedSurfaceCwd(terminals, "missing", null)).toBe("/first");
  });
});

describe("attachedTerminalGroupIdsForFrameMove", () => {
  it("returns groups containing terminals attached to moved frames", () => {
    const frame = {
      id: "frame",
      kind: "frame" as const,
      label: "Frame",
      technology: "",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    };
    const terminal = {
      ...node("terminal", "terminal", 20),
      frameId: "frame",
    };
    const layouts = [
      {
        groupId: "group-1",
        stackId: "stack-1",
        rect: { x: 0, y: 0, width: 100, height: 80 },
        terminalIds: ["terminal"],
        activeTerminalId: "terminal",
      },
    ];

    expect(
      attachedTerminalGroupIdsForFrameMove(
        [frame, terminal],
        layouts,
        new Set(["frame"]),
      ),
    ).toEqual(new Set(["group-1"]));
  });
});

describe("resolveCanvasDragMove", () => {
  it("computes bounds and attached group policy from one drag snapshot", () => {
    const frame = {
      id: "frame",
      kind: "frame" as const,
      label: "Frame",
      technology: "",
      x: 0,
      y: 0,
      width: 200,
      height: 200,
    };
    const terminal = { ...node("terminal", "terminal", 20), frameId: "frame" };
    const result = resolveCanvasDragMove({
      nodes: [frame, terminal],
      drag: { id: "frame", dx: 0, dy: 0 },
      point: { x: 30, y: 40 },
      bounds: { x: 0, y: 0, width: 500, height: 500 },
      selectedNodeIds: ["frame"],
      terminalLayouts: [],
    });

    expect(result?.nextBounds).toMatchObject({ x: 30, y: 40 });
    expect(result?.movedNodeIds).toEqual(new Set(["frame"]));
  });
});

describe("applyCanvasDragMove", () => {
  it("moves ordinary nodes while preserving the dock-group collection", () => {
    const item = node("node", "terminal", 20);
    const result = applyCanvasDragMove({
      nodes: [item],
      terminalDockGroups: [],
      drag: { id: "node", dx: 0, dy: 0 },
      point: { x: 60, y: 70 },
      bounds: { x: 0, y: 0, width: 500, height: 500 },
      selectedNodeIds: ["node"],
      terminalLayouts: [],
    });

    expect(result.nodes[0]).toMatchObject({ x: 60, y: 70 });
    expect(result.terminalDockGroups).toEqual([]);
  });
});
